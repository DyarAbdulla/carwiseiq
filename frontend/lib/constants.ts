/**
 * Constants for Car Price Predictor
 */

export const YEAR_RANGE = {
  min: 2000,
  max: 2025,
}

export const MILEAGE_RANGE = {
  min: 0,
  max: 500000,
}

export const ENGINE_SIZES = [
  1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.5, 2.7, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 8.0
]

export const CYLINDERS = [3, 4, 5, 6, 8, 10, 12]

export const CONDITIONS = [
  'New',
  'Like New',
  'Excellent',
  'Good',
  'Fair',
  'Poor',
  'Salvage'
]

export const FUEL_TYPES = [
  'Gasoline',
  'Diesel',
  'Electric',
  'Hybrid',
  'Plug-in Hybrid',
  'Other'
]

export const CAR_MAKES = [
  'Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'BMW', 'Mercedes-Benz',
  'Audi', 'Volkswagen', 'Hyundai', 'Kia', 'Mazda', 'Subaru', 'Lexus',
  'Acura', 'Infiniti', 'Cadillac', 'Lincoln', 'Buick', 'GMC', 'Jeep',
  'Ram', 'Dodge', 'Chrysler', 'Tesla', 'Volvo', 'Porsche', 'Jaguar',
  'Land Rover', 'Mini', 'Fiat', 'Alfa Romeo', 'Genesis', 'Mitsubishi'
]

export const MODELS_BY_MAKE: Record<string, string[]> = {
  'Toyota': ['Camry', 'Corolla', 'RAV4', 'Highlander', 'Prius', 'Sienna', 'Tacoma', 'Tundra', '4Runner', 'Sequoia'],
  'Honda': ['Accord', 'Civic', 'CR-V', 'Pilot', 'Odyssey', 'Ridgeline', 'Passport', 'HR-V'],
  'Ford': ['F-150', 'Mustang', 'Explorer', 'Escape', 'Edge', 'Expedition', 'Ranger', 'Bronco'],
  'Chevrolet': ['Silverado', 'Equinox', 'Tahoe', 'Suburban', 'Traverse', 'Malibu', 'Camaro', 'Corvette'],
  'Nissan': ['Altima', 'Sentra', 'Rogue', 'Pathfinder', 'Armada', 'Frontier', 'Titan', 'Murano'],
}

export const CAR_COLORS = [
  'Black',
  'White',
  'Silver',
  'Gray',
  'Blue',
  'Red',
  'Green',
  'Brown',
  'Beige',
  'Gold',
  'Orange',
  'Yellow',
  'Purple',
  'Other'
]

/** Iraq locations fallback (sorted) when dataset/API is unavailable. Matches backend fallback. */
export const IRAQ_LOCATIONS_FALLBACK = [
  'Abu Al-Khaseeb', 'Al-Fallujah', 'Al Nashwa', 'Amara', 'Anbar', 'Baqubah', 'Basra', 'Baghdad',
  'Diwaniyah', 'Duhok', 'Erbil', 'Haswa', 'Hillah', 'Karbala', 'Kirkuk', 'Kut', 'Latifiya',
  'Mosul', 'Najaf', 'Nasiriyah', 'Ramadi', 'Samarra', 'Sulaymaniyah',
].sort((a, b) => a.localeCompare(b))

export const SAMPLE_CAR = {
  year: 2020,
  mileage: 50000,
  engine_size: 2.5,
  cylinders: 4,
  make: 'Toyota',
  model: 'Camry',
  trim: 'LE', // Default trim for sample car (exists in dataset)
  condition: 'Good',
  fuel_type: 'Gasoline',
  location: 'Baghdad', // Updated to match dataset
}

