/**
 * Configuration Constants
 *
 * Source of truth: DESIGN-SPEC.md Sections 4, 9, 10
 * All tunable parameters live here. No magic numbers in components.
 */

// ── Force Simulation (Section 4: Force Configuration) ───────────

export const FORCE_CONFIG = {
  chargeStrength: -120,         // Repulsion between nodes
  linkDistance: 60,             // Preferred edge length
  collideRadiusPadding: 2,     // Extra space around node radius
  centerStrength: 0.05,        // Gentle pull toward center
  alphaDecay: 0.02,            // Slightly slower cooling for organic layout
  velocityDecay: 0.3,          // Moderate friction
  warmupTicks: 50,             // Pre-render before display
  cooldownTime: 10000,         // 10s simulation
} as const

// ── Node Size Levels (Section 9: 6 Discrete Levels) ────────────

export const SIZE_LEVELS = {
  xs:  4,
  s:   6,
  m:   8,
  l:   12,
  xl:  16,
  xxl: 20,
} as const

// Percentile breakpoints → size level
// 0-19 = xs, 20-39 = s, 40-59 = m, 60-79 = l, 80-94 = xl, 95-100 = xxl
export const SIZE_THRESHOLDS = [20, 40, 60, 80, 95] as const

// Project nodes always get L (12px) — structural, not ranked (D38)
export const PROJECT_NODE_RADIUS = 12

// ── Level of Detail / Zoom Thresholds (Section 9) ──────────────

export const LOD_THRESHOLDS = {
  dot:    0.3,    // < 0.3: dots only (2px)
  circle: 0.8,    // 0.3-0.8: circles, no labels
  label:  1.5,    // 0.8-1.5: circles + forced labels only
  full:   3.0,    // 1.5-3.0: all labels. >3.0: edge labels too
} as const

// ── Edge Rendering (Section 10) ────────────────────────────────

export const MAGNITUDE_WIDTH: Record<string, number> = {
  foundational: 2.5,
  significant:  1.5,
  marginal:     0.8,
}

export const EVIDENCE_DASH: Record<string, number[]> = {
  established: [],          // solid
  claimed:     [5, 3],      // long dash
  disputed:    [3, 3],      // medium dash
  speculative: [2, 4],      // short dash, wide gap
}

// ── Composite Importance Weights (Section 9, D36) ──────────────

export const IMPORTANCE_WEIGHTS = {
  pageRank:     0.35,
  betweenness:  0.25,
  degree:       0.20,
  projectCount: 0.20,
} as const

// ── Defaults ────────────────────────────────────────────────────

export const DEFAULT_HOP_RADIUS = 2

// ── Arrow Configuration ─────────────────────────────────────────

export const ARROW_LENGTH = 4
export const ARROW_REL_POS = 0.75

// ── Parallel Edge Curvature ─────────────────────────────────────

export const PARALLEL_EDGE_CURVATURE = 0.2  // Offset for parallel edges

// ── MENTIONED_IN Edge Styling ──────────────────────────────────

export const MENTIONED_IN_WIDTH = 0.5       // Thin structural edge
export const MENTIONED_IN_DASH = [3, 4]     // Short dash, subtle
export const MENTIONED_IN_CLASSIFICATION = 'MENTIONED_IN'  // Used as causalClassification value
