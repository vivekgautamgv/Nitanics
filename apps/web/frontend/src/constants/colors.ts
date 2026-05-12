/**
 * Color constants for the Frontend
 * Source of truth: DESIGN-SPEC.md Section 19
 */

export const CATEGORY_COLORS: Record<string, string> = {
  Person: '#4ADE80',
  Organization: '#60A5FA',
  Place: '#9CA3AF',
  Event: '#F87171',
  Concept: '#A78BFA',
  System: '#FB923C',
  Process: '#2DD4BF',
  Technology: '#38BDF8',
  Law: '#FBBF24',
  Agreement: '#E879F9',
  Metric: '#F59E0B',
  Document: '#94A3B8',
  Resource: '#34D399',
  Other: '#6B7280',
}

export const BRIDGE_COLORS = {
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
} as const

export const EVIDENCE_COLORS: Record<string, string> = {
  established: '#22C55E',
  claimed: '#60A5FA',
  disputed: '#F59E0B',
  speculative: '#9CA3AF',
}

export const MAGNITUDE_LABELS: Record<string, string> = {
  foundational: 'Foundational',
  significant: 'Significant',
  marginal: 'Marginal',
}
