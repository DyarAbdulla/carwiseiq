'use client'

import { useCallback, useState } from 'react'

function getLogoUrl(make: string): string {
  const map: Record<string, string> = {
    Toyota: 'toyota',
    Kia: 'kia',
    Hyundai: 'hyundai',
    Nissan: 'nissan',
    'Mercedes-Benz': 'mercedes-benz',
    Bmw: 'bmw',
    Honda: 'honda',
    Chevrolet: 'chevrolet',
    Ford: 'ford',
    Audi: 'audi',
    Volkswagen: 'volkswagen',
    Lexus: 'lexus',
    Jeep: 'jeep',
    Mitsubishi: 'mitsubishi',
    'Land Rover': 'land-rover',
    Porsche: 'porsche',
    Mazda: 'mazda',
    Volvo: 'volvo',
    Suzuki: 'suzuki',
    Infiniti: 'infiniti',
    Cadillac: 'cadillac',
    Dodge: 'dodge',
    Peugeot: 'peugeot',
    Renault: 'renault',
    Tesla: 'tesla',
    Mg: 'mg',
    Byd: 'byd',
    Haval: 'haval',
    Geely: 'geely',
    Chery: 'chery',
    Mini: 'mini',
    Jaguar: 'jaguar',
    Ferrari: 'ferrari',
    Lamborghini: 'lamborghini',
    Subaru: 'subaru',
    Skoda: 'skoda',
    Opel: 'opel',
    Fiat: 'fiat',
    Buick: 'buick',
    Gmc: 'gmc',
    Lincoln: 'lincoln',
    Acura: 'acura',
    Genesis: 'genesis',
    'Alfa Romeo': 'alfa-romeo',
    Chrysler: 'chrysler',
    'Rolls Royce': 'rolls-royce',
    Bentley: 'bentley',
    Ram: 'ram',
    Changan: 'changan',
    Jetour: 'jetour',
  }
  const slug = map[make]
  return slug ? `/logos/${slug}.svg` : ''
}

// Top makes for Iraq/Kurdistan market shown first
const TOP_MAKES = [
  'Toyota',
  'Kia',
  'Hyundai',
  'Nissan',
  'Mercedes-Benz',
  'Bmw',
  'Honda',
  'Chevrolet',
  'Mitsubishi',
  'Ford',
  'Lexus',
  'Land Rover',
  'Audi',
  'Jeep',
  'Haval',
  'Byd',
  'Mg',
  'Chery',
  'Geely',
  'Jetour',
]

interface BrandLogoGridProps {
  selectedMake: string
  onSelectMake: (make: string) => void
  allMakes: string[]
}

function BrandLogoButton({
  make,
  selected,
  onSelect,
}: {
  make: string
  selected: boolean
  onSelect: (make: string) => void
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const url = getLogoUrl(make)
  const showLetter = !url || imgFailed

  return (
    <button
      type="button"
      onClick={() => onSelect(make)}
      className={`flex flex-col items-center gap-1 p-2 rounded-xl border min-w-[68px] flex-shrink-0
        transition-all duration-200 cursor-pointer
        ${
          selected
            ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/20'
            : 'border-white/10 bg-white/5 hover:border-purple-500/40 hover:bg-white/10'
        }`}
    >
      {showLetter ? (
        <span className="w-9 h-9 flex items-center justify-center text-lg font-bold text-white/80">
          {make.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <img
          src={url}
          alt=""
          className="w-9 h-9 object-contain"
          onError={() => setImgFailed(true)}
        />
      )}
      <span className="text-[10px] text-white/60 whitespace-nowrap text-center leading-tight">{make}</span>
    </button>
  )
}

export default function BrandLogoGrid({ selectedMake, onSelectMake, allMakes }: BrandLogoGridProps) {
  const onSelect = useCallback(
    (make: string) => {
      onSelectMake(make)
    },
    [onSelectMake]
  )

  const displayMakes = [
    ...TOP_MAKES.filter((m) => allMakes.includes(m)),
    ...allMakes.filter((m) => !TOP_MAKES.includes(m) && getLogoUrl(m)),
  ]

  if (displayMakes.length === 0) return null

  return (
    <div className="mb-4">
      <p className="text-xs text-white/50 mb-2">Quick select brand</p>
      <div
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide cursor-grab active:cursor-grabbing"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {displayMakes.map((make) => (
          <BrandLogoButton key={make} make={make} selected={selectedMake === make} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}
