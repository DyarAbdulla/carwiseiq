/**
 * CarQuery API service for real car specifications
 * API docs: https://www.carqueryapi.com/
 */

const CARQUERY_BASE = 'https://www.carqueryapi.com/api/0.3/'

export interface CarQueryMake {
  make_id: string
  make_display: string
  make_is_common: string
  make_country: string
}

export interface CarQueryModel {
  model_name: string
  model_make_id: string
}

export interface CarQueryTrim {
  model_id: string
  model_make_id: string
  model_name: string
  model_trim: string
  model_year: string
  model_body: string
  model_engine_position: string
  model_engine_cc: string | null
  model_engine_cyl: string | null
  model_engine_type: string
  model_engine_power_ps: string | null
  model_engine_power_rpm: string | null
  model_engine_torque_nm: string | null
  model_engine_torque_rpm: string | null
  model_engine_fuel: string | null
  model_drive: string | null
  model_transmission_type: string | null
  model_lkm_city: string | null
  model_lkm_hwy: string | null
  model_lkm_mixed: string | null
  model_top_speed_kph: string | null
  model_0_to_100_kph: string | null
  [key: string]: unknown
}

export interface CarQuerySpecs {
  horsepower: number | null
  torque: number | null
  engineSize: number | null
  cylinders: number | null
  transmission: string | null
  drivetrain: string | null
  fuelType: string | null
  fuelEconomyCity: number | null
  fuelEconomyHighway: number | null
}

async function fetchCarQuery<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(CARQUERY_BASE)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`CarQuery API error: ${res.status}`)
  return res.json()
}

/**
 * Get all makes from CarQuery API
 */
export async function getCarQueryMakes(): Promise<CarQueryMake[]> {
  const data = await fetchCarQuery<{ Makes: CarQueryMake[] }>({ cmd: 'getMakes' })
  return data.Makes ?? []
}

/**
 * Get models for a make from CarQuery API
 */
export async function getCarQueryModels(make: string): Promise<CarQueryModel[]> {
  if (!make?.trim()) return []
  const data = await fetchCarQuery<{ Models: CarQueryModel[] }>({
    cmd: 'getModels',
    make: make.trim(),
  })
  return data.Models ?? []
}

/**
 * Get trims/specs for make, model, year from CarQuery API
 */
export async function getCarQueryTrims(
  make: string,
  model: string,
  year: number
): Promise<CarQueryTrim[]> {
  if (!make?.trim() || !model?.trim()) return []
  const data = await fetchCarQuery<{ Trims: CarQueryTrim[] }>({
    cmd: 'getTrims',
    make: make.trim(),
    model: model.trim(),
    year: String(year),
  })
  return data.Trims ?? []
}

/**
 * Convert CarQuery trim to display specs.
 * PS to hp: 1 PS ≈ 0.986 hp (use 1:1 for display simplicity)
 * Nm to lb-ft: 1 Nm ≈ 0.7376 lb-ft
 * cc to L: cc / 1000
 */
function trimToSpecs(trim: CarQueryTrim): CarQuerySpecs {
  const parseNum = (v: string | null | undefined): number | null => {
    if (v == null || v === '') return null
    const n = parseFloat(String(v))
    return isNaN(n) ? null : n
  }

  const ps = parseNum(trim.model_engine_power_ps)
  const nm = parseNum(trim.model_engine_torque_nm)
  const cc = parseNum(trim.model_engine_cc)
  const cyl = parseNum(trim.model_engine_cyl)
  const city = parseNum(trim.model_lkm_city)
  const hwy = parseNum(trim.model_lkm_hwy)

  return {
    horsepower: ps != null ? Math.round(ps * 0.986) : null,
    torque: nm != null ? Math.round(nm * 0.7376) : null,
    engineSize: cc != null ? Math.round((cc / 1000) * 10) / 10 : null,
    cylinders: cyl,
    transmission: trim.model_transmission_type?.trim() || null,
    drivetrain: trim.model_drive?.trim() || null,
    fuelType: trim.model_engine_fuel?.trim() || null,
    fuelEconomyCity: city,
    fuelEconomyHighway: hwy,
  }
}

/**
 * Find best matching trim by engine size and cylinders if provided.
 * Falls back to first trim if no match.
 */
function selectBestTrim(
  trims: CarQueryTrim[],
  engineSize?: number,
  cylinders?: number
): CarQueryTrim | null {
  if (!trims.length) return null
  if (engineSize == null && cylinders == null) return trims[0]

  const engineL = engineSize != null ? engineSize : 0
  const cyl = cylinders ?? 0

  const score = (t: CarQueryTrim) => {
    let s = 0
    const tCc = t.model_engine_cc ? parseFloat(t.model_engine_cc) / 1000 : 0
    const tCyl = t.model_engine_cyl ? parseInt(t.model_engine_cyl, 10) : 0
    if (engineL > 0 && tCc > 0) {
      const diff = Math.abs(tCc - engineL)
      s += 100 - Math.min(100, diff * 50)
    }
    if (cyl > 0 && tCyl > 0 && tCyl === cyl) s += 50
    return s
  }

  const sorted = [...trims].sort((a, b) => score(b) - score(a))
  return sorted[0]
}

/**
 * Fetch real car specs from CarQuery API.
 * Returns null if API fails or no trims found.
 * Use engineSize/cylinders to prefer a matching trim when multiple exist.
 */
export async function fetchCarQuerySpecs(
  make: string,
  model: string,
  year: number,
  options?: { engineSize?: number; cylinders?: number }
): Promise<CarQuerySpecs | null> {
  try {
    const trims = await getCarQueryTrims(make, model, year)
    const trim = selectBestTrim(
      trims,
      options?.engineSize,
      options?.cylinders
    )
    if (!trim) return null
    return trimToSpecs(trim)
  } catch {
    return null
  }
}

/** CarSpecsResult-compatible shape for Compare page (from carSpecifications.ts) */
export interface CarQuerySpecsResult {
  horsepower?: number | null
  torque?: number | null
  engineSize?: number | null
  cylinders?: number | null
  transmission?: string | null
  drivetrain?: string | null
  fuelType?: string | null
  fuelEconomy?: { city: number; highway: number } | null
  /** 0–60 mph seconds when available */
  acceleration?: number | null
}

/** Convert CarQuerySpecs to CarSpecsResult format for display */
export function carQuerySpecsToResult(specs: CarQuerySpecs | null): CarQuerySpecsResult | null {
  if (!specs) return null
  const fe =
    specs.fuelEconomyCity != null && specs.fuelEconomyHighway != null
      ? { city: specs.fuelEconomyCity, highway: specs.fuelEconomyHighway }
      : null
  return {
    horsepower: specs.horsepower,
    torque: specs.torque,
    engineSize: specs.engineSize,
    cylinders: specs.cylinders,
    transmission: specs.transmission,
    drivetrain: specs.drivetrain,
    fuelType: specs.fuelType,
    fuelEconomy: fe,
  }
}
