export interface CarSpecsInput {
  make?: string
  model?: string
  year?: number
  transmission?: string
  fuel_type?: string
  mileage?: number
  [key: string]: unknown
}

export interface FuelEconomy {
  city: number
  highway: number
}

export interface CarSpecsResult {
  horsepower?: number | null
  fuelEconomy?: FuelEconomy | null
  reliabilityRating?: number | null
  acceleration?: number | null
  torque?: number | null
  topSpeed?: number | null
  transmission?: string | null
  drivetrain?: string | null
}

const FALLBACK_HP: Record<string, number> = {
  toyota: 180, honda: 190, ford: 200, bmw: 250, mercedes: 260,
  nissan: 180, chevrolet: 200, hyundai: 170, kia: 170, audi: 240,
}

export function getCarSpecs(input: CarSpecsInput): CarSpecsResult {
  const make = (input.make ?? '').toLowerCase().replace(/\s+/g, '')
  const year = typeof input.year === 'number' ? input.year : new Date().getFullYear()
  const hp = FALLBACK_HP[make] ?? 180
  const yearFactor = Math.min(1.2, 0.8 + (year - 2015) * 0.02)
  const transmission = input.transmission || 'Automatic'
  return {
    horsepower: Math.round(hp * yearFactor),
    fuelEconomy: { city: 24, highway: 32 },
    reliabilityRating: 75,
    acceleration: 7.5,
    torque: 200,
    topSpeed: 130,
    transmission,
    drivetrain: 'FWD',
  }
}
