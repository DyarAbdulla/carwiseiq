/**
 * Realistic cylinder counts for a given displacement (liters).
 * Used to filter cylinder options on the predict form.
 */
export function getCylinderOptionsForDisplacement(liters: number): number[] {
  if (typeof liters !== 'number' || isNaN(liters) || liters < 0.5) {
    return [4]
  }
  if (liters < 1.5) return [3, 4]
  if (liters < 2.5) return [4]
  if (liters < 3.5) return [4, 6]
  if (liters < 5.0) return [6, 8]
  if (liters < 6.5) return [8]
  return [8, 10, 12]
}

/** Most common cylinder count for a displacement band (auto-select). */
export function getDefaultCylinderForDisplacement(liters: number): number {
  if (typeof liters !== 'number' || isNaN(liters) || liters < 0.5) {
    return 4
  }
  if (liters < 1.5) return 4
  if (liters < 2.5) return 4
  if (liters < 3.5) return liters < 3.0 ? 4 : 6
  if (liters < 5.0) return liters < 4.5 ? 6 : 8
  if (liters < 6.5) return 8
  return 8
}
