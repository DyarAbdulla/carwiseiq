import type { ReactNode } from 'react'

export const metadata = {
  title: 'Car Listing - CarWiseIQ',
  description: 'View car listing details on CarWiseIQ marketplace',
}

export function generateStaticParams() {
  return [{ id: '0' }]
}

export default function ListingDetailLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
