import { CATEGORIES, CAUSAL_FAMILIES } from '../constants/index.js';

// Word-boundary patterns to avoid false positives (e.g., "OFFSET" matching "SET")
const WRITE_PATTERNS = [
  /\bCREATE\b/, /\bMERGE\b/, /\bDELETE\b/, /\bDETACH\b/, /\bREMOVE\b/,
  /\bSET\b/, /\bDROP\b/,
  /\bCALL\s+gds\b/i, /\bCALL\s+apoc\b/i, /\bCALL\s+dbms\b/i, /\bLOAD\s+CSV\b/i,
];

/** Block write operations in raw Cypher queries */
export function sanitizeCypher(query: string): string | null {
  const upper = query.toUpperCase();
  for (const pattern of WRITE_PATTERNS) {
    const match = upper.match(pattern);
    if (match) {
      return `Blocked: query contains "${match[0]}". Only read queries allowed.`;
    }
  }
  if (query.length > 4096) {
    return 'Blocked: query exceeds 4096 character limit.';
  }
  return null;
}

export function isValidCategory(cat: string): boolean {
  return (CATEGORIES as readonly string[]).includes(cat);
}

export function isValidCausalFamily(family: string): boolean {
  return (CAUSAL_FAMILIES as readonly string[]).includes(family);
}
