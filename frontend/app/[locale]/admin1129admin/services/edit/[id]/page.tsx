import EditServicePage from './EditServiceClient'

export function generateStaticParams() {
  return [{ id: '0' }]
}

export default function Page() {
  return <EditServicePage />
}
