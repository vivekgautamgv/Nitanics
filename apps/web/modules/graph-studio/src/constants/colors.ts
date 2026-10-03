/**
 * Color System - Complete mapping
 */

export const CATEGORY_COLORS: Record<string, string> = {
  Person:       '#5b8c6a',
  Organization: '#6b84a6',
  Place:        '#8d949e',
  Event:        '#c47b72',
  Concept:      '#8a78b8',
  System:       '#b8865d',
  Process:      '#6f9c96',
  Technology:   '#6f96b5',
  Law:          '#b59657',
  Agreement:    '#b3849f',
  Metric:       '#b48b55',
  Document:     '#97a1ad',
  Resource:     '#739880',
  Other:        '#7b818c',
}

export const CAUSAL_COLORS: Record<string, string> = {
  CAUSES:          '#b56b63',
  ENABLES:         '#6d8e75',
  BLOCKS:          '#b98056',
  INFLUENCES:      '#8472ad',
  DEPENDS_ON:      '#6a84ad',
  CONTRADICTS:     '#9d5953',
  SUPPORTS:        '#5f8468',
  PRECEDES:        '#9aa0a8',
  COMPETES_WITH:   '#b18a52',
  COOPERATES_WITH: '#68939a',
  REGULATES:       '#9d7193',
  TRANSFORMS:      '#b06f7f',
  PRODUCES:        '#87995b',
  CONSUMES:        '#847c72',
  IMPLEMENTS:      '#5f8fa8',
}

export const MENTIONED_IN_COLOR = '#b6b3ab'

export const BRIDGE_COLORS: Record<string, string> = {
  gold:   '#b39352',
  silver: '#aeb4bd',
  bronze: '#a17252',
  none:   'transparent',
}

export const EVIDENCE_COLORS: Record<string, string> = {
  established: '#6d8e75',
  claimed:     '#b59657',
  disputed:    '#c47b72',
  speculative: '#8a78b8',
}

export const THEME = {
  bg:            '#FAFAFA',
  surface:       '#FFFFFF',
  surfaceHover:  '#F4F4F5',
  border:        '#E4E4E7',
  textPrimary:   '#18181B',
  textSecondary: '#52525B',
  textMuted:     '#A1A1AA',
  accent:        '#2563EB',
  warning:       '#CA8A04',
  error:         '#DC2626',
} as const

export const PROJECT_NODE_COLOR = '#2563EB'
