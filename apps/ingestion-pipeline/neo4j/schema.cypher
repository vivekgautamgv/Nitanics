// ============================================================
// MemoryTonic v4 — Neo4j Schema
//
// Run via: python neo4j/bootstrap.py
// Database: memorytonic
// ============================================================

// ---------------------------------------------------------------
// STEP 1: Clean slate (drop all existing data)
// ---------------------------------------------------------------
// MATCH (n) DETACH DELETE n;
// (Run separately — not in bootstrap by default. Uncomment if needed.)

// ---------------------------------------------------------------
// STEP 2: Constraints (unique IDs)
// ---------------------------------------------------------------

CREATE CONSTRAINT entity_id IF NOT EXISTS
FOR (e:Entity) REQUIRE e.entityId IS UNIQUE;

CREATE CONSTRAINT project_id IF NOT EXISTS
FOR (p:Project) REQUIRE p.projectId IS UNIQUE;

CREATE CONSTRAINT collection_id IF NOT EXISTS
FOR (c:Collection) REQUIRE c.collectionId IS UNIQUE;

CREATE CONSTRAINT directory_name IF NOT EXISTS
FOR (d:DirectoryCategory) REQUIRE d.name IS UNIQUE;

CREATE CONSTRAINT datetime_id IF NOT EXISTS
FOR (dt:DateTime) REQUIRE dt.datetimeId IS UNIQUE;

CREATE CONSTRAINT temporal_event_id IF NOT EXISTS
FOR (te:TemporalEvent) REQUIRE te.eventId IS UNIQUE;

CREATE CONSTRAINT causal_chain_id IF NOT EXISTS
FOR (cc:CausalChain) REQUIRE cc.chainId IS UNIQUE;

// ---------------------------------------------------------------
// STEP 3: Indexes (search performance)
// ---------------------------------------------------------------

CREATE INDEX entity_name IF NOT EXISTS
FOR (e:Entity) ON (e.name);

CREATE INDEX entity_category IF NOT EXISTS
FOR (e:Entity) ON (e.category);

CREATE INDEX project_name IF NOT EXISTS
FOR (p:Project) ON (p.name);

CREATE INDEX collection_name IF NOT EXISTS
FOR (c:Collection) ON (c.name);

CREATE INDEX temporal_event_project IF NOT EXISTS
FOR (te:TemporalEvent) ON (te.projectId);

// ---------------------------------------------------------------
// STEP 4: Full-text search index
// ---------------------------------------------------------------

CREATE FULLTEXT INDEX entity_fulltext IF NOT EXISTS
FOR (e:Entity)
ON EACH [e.name, e.definition, e.aliases_text];

// ---------------------------------------------------------------
// STEP 5: Vector indexes (384d BERT embeddings)
// ---------------------------------------------------------------

CREATE VECTOR INDEX entityEmbedding IF NOT EXISTS
FOR (e:Entity) ON (e.embedding)
OPTIONS {indexConfig: {
  `vector.dimensions`: 384,
  `vector.similarity_function`: 'cosine'
}};

CREATE VECTOR INDEX projectEmbedding IF NOT EXISTS
FOR (p:Project) ON (p.embedding)
OPTIONS {indexConfig: {
  `vector.dimensions`: 384,
  `vector.similarity_function`: 'cosine'
}};

// ---------------------------------------------------------------
// STEP 6: Default directories
// ---------------------------------------------------------------

MERGE (d:DirectoryCategory {name: 'Research'})
SET d.description = 'Research papers, investigations, academic studies';

MERGE (d:DirectoryCategory {name: 'Business'})
SET d.description = 'Business processes, operations, strategy documents';

MERGE (d:DirectoryCategory {name: 'Personal'})
SET d.description = 'Personal knowledge, notes, learning materials';
