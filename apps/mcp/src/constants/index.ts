// 14 Entity Categories (locked, ontological)
export const CATEGORIES = [
  'Person', 'Organization', 'Place', 'Event', 'Concept', 'System',
  'Process', 'Technology', 'Law', 'Agreement', 'Metric', 'Document',
  'Resource', 'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

// 15 Causal Classification Families (locked)
export const CAUSAL_FAMILIES = [
  'CAUSES', 'ENABLES', 'BLOCKS', 'INFLUENCES', 'DEPENDS_ON',
  'CONTRADICTS', 'SUPPORTS', 'PRECEDES', 'COMPETES_WITH',
  'COOPERATES_WITH', 'REGULATES', 'TRANSFORMS', 'PRODUCES',
  'CONSUMES', 'IMPLEMENTS',
] as const;

export type CausalFamily = (typeof CAUSAL_FAMILIES)[number];

// Evidence strength levels
export const EVIDENCE_STRENGTHS = [
  'established', 'claimed', 'disputed', 'speculative',
] as const;

export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

// Magnitude levels
export const MAGNITUDES = [
  'foundational', 'significant', 'marginal',
] as const;

export type Magnitude = (typeof MAGNITUDES)[number];

// Bridge tiers (computed at query time, not stored)
export const BRIDGE_TIERS = {
  GOLD: { minProjects: 3 },
  SILVER: { minProjects: 2 },
  BRONZE: { minProjects: 1, minBetweenness: 1000 },
} as const;

// Default directories
export const DEFAULT_DIRECTORIES = ['Research', 'Business', 'Personal'] as const;
