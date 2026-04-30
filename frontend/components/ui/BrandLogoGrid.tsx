'use client'

import { useCallback, useState } from 'react'

const BRAND_LOGOS: Record<string, string> = {
  Toyota: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Toyota.svg/120px-Toyota.svg.png',
  Kia: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Kia-logo.svg/120px-Kia-logo.svg.png',
  Hyundai:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Hyundai_Motor_Company_logo.svg/120px-Hyundai_Motor_Company_logo.svg.png',
  Nissan: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Nissan_2020_logo.svg/120px-Nissan_2020_logo.svg.png',
  'Mercedes-Benz': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Mercedes-Logo.svg/120px-Mercedes-Logo.svg.png',
  Bmw: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/BMW.svg/120px-BMW.svg.png',
  Honda: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Honda.svg/120px-Honda.svg.png',
  Chevrolet: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Chevrolet_logo.svg/120px-Chevrolet_logo.svg.png',
  Ford: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Ford_logo_flat.svg/120px-Ford_logo_flat.svg.png',
  Audi: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Audi-Logo_2016.svg/120px-Audi-Logo_2016.svg.png',
  Volkswagen: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Volkswagen_logo_2019.svg/120px-Volkswagen_logo_2019.svg.png',
  Lexus: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Lexus_-_Logo.svg/120px-Lexus_-_Logo.svg.png',
  Jeep: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Jeep_logo.svg/120px-Jeep_logo.svg.png',
  Mitsubishi: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Mitsubishi_logo.svg/120px-Mitsubishi_logo.svg.png',
  'Land Rover': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Land_Rover_logo.svg/120px-Land_Rover_logo.svg.png',
  Porsche: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Porsche_logo.svg/120px-Porsche_logo.svg.png',
  Mazda: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Mazda_logo_with_text.svg/120px-Mazda_logo_with_text.svg.png',
  Volvo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Volvo_logo.svg/120px-Volvo_logo.svg.png',
  Suzuki: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Suzuki_logo_2.svg/120px-Suzuki_logo_2.svg.png',
  Infiniti: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Infiniti_logo.svg/120px-Infiniti_logo.svg.png',
  Cadillac: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Cadillac_logo.svg/120px-Cadillac_logo.svg.png',
  Dodge: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Dodge_logo.svg/120px-Dodge_logo.svg.png',
  Peugeot: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Peugeot_2021_Logo.svg/120px-Peugeot_2021_Logo.svg.png',
  Renault: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Renault_2021_Text.svg/120px-Renault_2021_Text.svg.png',
  Tesla: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Tesla_T_symbol.svg/120px-Tesla_T_symbol.svg.png',
  Mg: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/MG_Motor_logo.svg/120px-MG_Motor_logo.svg.png',
  Byd: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/BYD_Auto_logo.svg/120px-BYD_Auto_logo.svg.png',
  Haval: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Haval_logo.svg/120px-Haval_logo.svg.png',
  Geely: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Geely_Auto_logo.svg/120px-Geely_Auto_logo.svg.png',
  Chery: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Chery_logo.svg/120px-Chery_logo.svg.png',
  Mini: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Mini_logo.svg/120px-Mini_logo.svg.png',
  Jaguar: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Jaguar_Cars_logo.svg/120px-Jaguar_Cars_logo.svg.png',
  Ferrari: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Ferrari-Logo.svg/120px-Ferrari-Logo.svg.png',
  Lamborghini: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Lamborghini-Logo.svg/120px-Lamborghini-Logo.svg.png',
  Subaru: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Subaru_logo.svg/120px-Subaru_logo.svg.png',
  Skoda:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/%C5%A0koda_Auto_logo.svg/120px-%C5%A0koda_Auto_logo.svg.png',
  Opel: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Opel_logo_2017.svg/120px-Opel_logo_2017.svg.png',
  Fiat: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Fiat_logo.svg/120px-Fiat_logo.svg.png',
  Buick: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Buick_logo.svg/120px-Buick_logo.svg.png',
  Gmc: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/GMC_logo.svg/120px-GMC_logo.svg.png',
  Lincoln:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Lincoln_Motor_Company_logo.svg/120px-Lincoln_Motor_Company_logo.svg.png',
  Acura: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Acura_logo.svg/120px-Acura_logo.svg.png',
  Genesis: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Genesis_Motor_logo.svg/120px-Genesis_Motor_logo.svg.png',
  'Alfa Romeo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Alfa_Romeo_logo.svg/120px-Alfa_Romeo_logo.svg.png',
  Chrysler: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Chrysler_logo.svg/120px-Chrysler_logo.svg.png',
  'Rolls Royce': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Rolls-Royce-Logo.svg/120px-Rolls-Royce-Logo.svg.png',
  Hummer: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Hummer-Logo.svg/120px-Hummer-Logo.svg.png',
  Bentley: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Bentley_logo.svg/120px-Bentley_logo.svg.png',
  Ram: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Ram_logo.svg/120px-Ram_logo.svg.png',
  Jetour: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Jetour_logo.svg/120px-Jetour_logo.svg.png',
  Changan: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Changan_logo.svg/120px-Changan_logo.svg.png',
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
  const url = BRAND_LOGOS[make]
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
    ...allMakes.filter((m) => !TOP_MAKES.includes(m) && BRAND_LOGOS[m]),
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
