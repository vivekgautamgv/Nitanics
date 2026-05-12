import type { Category, CausalFamily, EvidenceStrength, Magnitude } from '../constants/index.js';

// --- Neo4j Node Types ---

export interface Entity {
  entityId: string;
  name: string;
  aliases: string[];
  aliases_text: string;
  category: Category;
  definition: string;
  role: string;
  firstAppearanceIndex: number;
  projectCount: number;
  embedding?: number[];
  pageRank?: number;
  betweenness?: number;
  degree?: number;
  createdAt: string;
}

export interface Project {
  projectId: string;
  name: string;
  uniqueId: string;
  summary: string;
  narrativeFlow: string[];
  domain: string;
  subdomain: string;
  baseTags: string[];
  htmlPath: string;
  directory: string;
  createdAt: string;
  embedding?: number[];
}

export interface Collection {
  collectionId: string;
  name: string;
  createdAt: string;
}

export interface DirectoryCategory {
  name: string;
  description: string;
}

export interface DateTimeNode {
  datetimeId: string;
  date: string;
  type: 'date' | 'time';
  year?: number;
  month?: number;
  day?: number;
  time?: string;
}

export interface TemporalEvent {
  eventId: string;
  projectId: string;
  phaseIndex: number;
  label: string;
  period: string;
}

export interface CausalChain {
  chainId: string;
  name: string;
  description: string;
  linkCount: number;
  projectId: string;
  createdAt: string;
}

// --- Relationship Types ---

export interface RelatesTo {
  relType: string;
  causalClassification: CausalFamily;
  description: string;
  evidence: string;
  evidenceStrength: EvidenceStrength;
  magnitude: Magnitude;
  year?: string;
}

export interface MentionedIn {
  role: string;
}

export interface SimilarTo {
  similarity: number;
}

export interface ChainLink {
  chainId: string;
  orderIndex: number;
  explanation: string;
}

// --- Extraction Payload (what Claude sends to memorytonic_extract) ---

export interface ExtractionPlacement {
  directory: string;
  project_name: string;
  unique_id: string;
  collection: string;
  collection_is_new: boolean;
}

export interface ExtractionEntity {
  name: string;
  aliases: string[];
  category: Category;
  definition: string;
  role: string;
  first_appearance_index: number;
}

export interface ExtractionTemporalPhase {
  index: number;
  label: string;
  period: string;
}

export interface ExtractionRelationship {
  source: string;
  target: string;
  relType: string;
  causalClassification: CausalFamily;
  description: string;
  evidence: string;
  evidenceStrength: EvidenceStrength;
  magnitude: Magnitude;
  year?: string;
}

export interface ExtractionChainLink {
  source: string;
  target: string;
  explanation: string;
}

export interface ExtractionCausalChain {
  name: string;
  description: string;
  links: ExtractionChainLink[];
}

export interface ExtractionPayload {
  placement: ExtractionPlacement;
  html_content: string;
  entities: {
    temporal_phases: ExtractionTemporalPhase[];
    entities: ExtractionEntity[];
  };
  extraction: {
    project: {
      name: string;
      unique_id: string;
      summary: string;
      narrative_flow: string[];
      tags: {
        domain: string;
        subdomain: string;
        base_tags: string[];
      };
    };
    relationships: ExtractionRelationship[];
    causal_chains: ExtractionCausalChain[];
  };
}

// --- Bridge Tier (computed at query time) ---

export type BridgeTier = 'Gold' | 'Silver' | 'Bronze' | null;

// --- Python spawn result ---

export interface SpawnResult {
  stdout: string;
  stderr: string;
  code: number;
}
