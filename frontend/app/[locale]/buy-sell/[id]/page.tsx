import ListingDetailClient from './ListingDetailClient'

export function generateStaticParams() {
  return [{ id: '0' }]
}

export default function Page() {
  return <ListingDetailClient />
}
