import { useEffect } from 'react'
import { useNavigationStore } from '@/stores/navigation-store'

/** Legacy route — redirects to collection Graph tab. */
export default function GraphPage({ collectionName }: { collectionName: string }) {
  const navigate = useNavigationStore(s => s.navigate)

  useEffect(() => {
    navigate({ page: 'collection', name: collectionName, tab: 'graph' })
  }, [collectionName, navigate])

  return null
}
