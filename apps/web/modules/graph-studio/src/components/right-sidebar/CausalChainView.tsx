/**
 * CausalChainView — Displays causal chains an entity participates in
 *
 * Source of truth: DESIGN-SPEC.md Section 6 (Causal Chains in Entity Card)
 * Shows ordered chain links with explanations.
 */


interface ChainLink {
  chainId: string
  chainName: string
  linkedEntity: string
  orderIndex: number
  explanation: string
}

interface Props {
  chainLinks: ChainLink[]
  onEntityClick?: (entityName: string) => void
}

export default function CausalChainView({ chainLinks, onEntityClick }: Props) {
  if (chainLinks.length === 0) {
    return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No causal chains</p>
  }

  // Group by chainId
  const chains = new Map<string, { name: string; links: ChainLink[] }>()
  for (const link of chainLinks) {
    if (!chains.has(link.chainId)) {
      chains.set(link.chainId, { name: link.chainName, links: [] })
    }
    chains.get(link.chainId)!.links.push(link)
  }

  // Sort links within each chain by orderIndex
  for (const chain of chains.values()) {
    chain.links.sort((a, b) => a.orderIndex - b.orderIndex)
  }

  return (
    <div className="space-y-2">
      {[...chains.entries()].map(([chainId, chain]) => (
        <div key={chainId}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {chain.name}
          </p>
          <div className="space-y-0.5 ml-1">
            {chain.links.map((link, i) => (
              <div key={`${link.linkedEntity}-${i}`} className="flex items-start gap-1.5">
                <span
                  className="text-xs flex-shrink-0 mt-0.5"
                  style={{ color: 'var(--text-muted)', fontSize: '9px', width: '12px', textAlign: 'right' }}
                >
                  {link.orderIndex}
                </span>
                <div className="min-w-0 flex-1">
                  <span
                    className="text-xs cursor-pointer hover:underline"
                    style={{ color: 'var(--accent)' }}
                    onClick={() => onEntityClick?.(link.linkedEntity)}
                  >
                    {link.linkedEntity}
                  </span>
                  {link.explanation && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {link.explanation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
