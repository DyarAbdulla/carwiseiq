import type { ReactNode } from 'react'

export function generateStaticParams() {
  return [{ 'listing-id': '0' }]
}

export default function ListingIdLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
