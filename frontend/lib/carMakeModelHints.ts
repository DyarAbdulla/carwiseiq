/** Lightweight make/model hints for sell wizard autocomplete (English keys; display is user-typed). */

const DATA: { make: string; models: string[] }[] = [
  { make: "Toyota", models: ["Camry", "Corolla", "RAV4", "Highlander", "Land Cruiser", "Prado", "Yaris", "Avalon", "C-HR", "bZ4X"] },
  { make: "Honda", models: ["Accord", "Civic", "CR-V", "Pilot", "HR-V", "Odyssey", "Passport", "Ridgeline"] },
  { make: "Hyundai", models: ["Tucson", "Santa Fe", "Elantra", "Sonata", "Palisade", "Kona", "Venue", "Ioniq"] },
  { make: "Kia", models: ["Sportage", "Sorento", "Telluride", "Forte", "K5", "Soul", "Niro", "Carnival"] },
  { make: "Nissan", models: ["Altima", "Sentra", "Rogue", "Pathfinder", "Murano", "Frontier", "Titan", "Armada"] },
  { make: "Mazda", models: ["CX-5", "CX-9", "CX-50", "Mazda3", "Mazda6", "CX-30", "MX-5"] },
  { make: "Ford", models: ["F-150", "Explorer", "Escape", "Bronco", "Mustang", "Edge", "Ranger"] },
  { make: "Chevrolet", models: ["Tahoe", "Suburban", "Silverado", "Equinox", "Traverse", "Malibu", "Camaro"] },
  { make: "BMW", models: ["3 Series", "5 Series", "X3", "X5", "X1", "4 Series", "7 Series"] },
  { make: "Mercedes-Benz", models: ["C-Class", "E-Class", "GLE", "GLC", "S-Class", "A-Class", "G-Class"] },
  { make: "Audi", models: ["A4", "A6", "Q5", "Q7", "A3", "e-tron", "Q3"] },
  { make: "Lexus", models: ["RX", "ES", "NX", "GX", "LX", "IS", "UX"] },
  { make: "GMC", models: ["Sierra", "Yukon", "Acadia", "Terrain", "Canyon"] },
  { make: "Jeep", models: ["Grand Cherokee", "Wrangler", "Cherokee", "Compass", "Gladiator"] },
  { make: "Volkswagen", models: ["Jetta", "Tiguan", "Atlas", "Golf", "ID.4", "Passat"] },
  { make: "Subaru", models: ["Outback", "Forester", "Crosstrek", "Ascent", "WRX"] },
  { make: "Mitsubishi", models: ["Outlander", "Eclipse Cross", "Mirage", "Pajero"] },
  { make: "Peugeot", models: ["3008", "5008", "2008", "508", "Partner"] },
  { make: "Renault", models: ["Duster", "Megane", "Clio", "Koleos", "Captur"] },
  { make: "Changan", models: ["CS35", "CS55", "CS75", "UNI-K", "Alsvin"] },
  { make: "Haval", models: ["H6", "Jolion", "H9", "Dargo"] },
  { make: "MG", models: ["ZS", "HS", "RX5", "GT"] },
]

const MAKES = DATA.map((d) => d.make)

export function suggestMakes(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return MAKES.slice(0, limit)
  return MAKES.filter((m) => m.toLowerCase().includes(q)).slice(0, limit)
}

export function suggestModels(make: string, query: string, limit = 10): string[] {
  const row = DATA.find((d) => d.make.toLowerCase() === make.trim().toLowerCase())
  if (!row) return []
  const q = query.trim().toLowerCase()
  if (!q) return row.models.slice(0, limit)
  return row.models.filter((m) => m.toLowerCase().includes(q)).slice(0, limit)
}
