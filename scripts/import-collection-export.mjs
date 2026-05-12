import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import neo4j from 'neo4j-driver'

function usage() {
  console.log('Usage: node scripts/import-collection-export.mjs <exportDir> [--collection-name "Name"] [--directory-name "Name"]')
}

const args = process.argv.slice(2)
if (args.length === 0) {
  usage()
  process.exit(1)
}

const exportDir = path.resolve(args[0])

function readFlag(flag) {
  const idx = args.indexOf(flag)
  return idx >= 0 ? args[idx + 1] : null
}

const collectionNameOverride = readFlag('--collection-name')
const directoryNameOverride = readFlag('--directory-name')

const manifestPath = path.join(exportDir, 'manifest.json')
const graphPath = path.join(exportDir, 'graph.json')

if (!fs.existsSync(manifestPath) || !fs.existsSync(graphPath)) {
  console.error('Export bundle is missing manifest.json or graph.json:', exportDir)
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'))

if (manifest.format !== 'memorytonic-collection-export') {
  console.error('Unsupported export format:', manifest.format)
  process.exit(1)
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(repoRoot, 'apps', 'ingestion-pipeline', 'data', 'sources')
const exportDate = String(graph?.meta?.exported_at || manifest?.exported_at || new Date().toISOString()).slice(0, 10)

const ACRONYMS = new Map([
  ['ai', 'AI'],
  ['agi', 'AGI'],
  ['api', 'API'],
  ['arc', 'ARC'],
  ['aws', 'AWS'],
  ['brt', 'BRT'],
  ['dc', 'DC'],
  ['drdo', 'DRDO'],
  ['ev', 'EV'],
  ['fpv', 'FPV'],
  ['gps', 'GPS'],
  ['iit', 'IIT'],
  ['iits', 'IITs'],
  ['llm', 'LLM'],
  ['nit', 'NIT'],
  ['nits', 'NITs'],
  ['osint', 'OSINT'],
  ['pr', 'PR'],
  ['rde', 'RDE'],
  ['sdk', 'SDK'],
  ['smt', 'SMT'],
  ['sota', 'SOTA'],
  ['tdcs', 'tDCS'],
  ['trl', 'TRL'],
  ['tts', 'TTS'],
  ['uav', 'UAV'],
  ['uleo', 'ULEO'],
  ['url', 'URL'],
  ['v3', 'V3'],
  ['visa', 'Visa'],
  ['vla', 'VLA'],
  ['yt', 'YT'],
  ['youtube', 'YouTube'],
])

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function titleCaseWord(word) {
  const lower = word.toLowerCase()
  if (ACRONYMS.has(lower)) return ACRONYMS.get(lower)
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function humanizeSlug(slug) {
  return String(slug || '')
    .split(/[-_]+/)
    .filter(Boolean)
    .map(titleCaseWord)
    .join(' ')
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
}

function readHtmlTitle(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback
  const html = fs.readFileSync(filePath, 'utf8')
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i) || html.match(/<h1>([^<]+)<\/h1>/i)
  if (!titleMatch) return fallback
  return decodeEntities(titleMatch[1]).trim() || fallback
}

const rawCollectionSlug = manifest.collection || graph?.meta?.collection || path.basename(exportDir)
const directorySlug = graph?.projects?.[0]?.directory || 'imports'
const collectionName = collectionNameOverride || humanizeSlug(rawCollectionSlug)
const directoryName = directoryNameOverride || humanizeSlug(directorySlug)
const directoryDescription = `Imported knowledge graph collections for ${directoryName}.`

const projectDocs = new Map()
const projectDisplayNames = new Map()

for (const project of graph.projects || []) {
  const uniqueId = slugify(project.name)
  const sourceHtml = path.join(exportDir, project.html_file || project.htmlPath || `projects/${project.name}/source.html`)
  const displayName = readHtmlTitle(sourceHtml, humanizeSlug(project.name))
  projectDocs.set(uniqueId, {
    sourceHtml,
    targetRelativePath: path.posix.join('data', 'sources', exportDate, uniqueId, '01_html.html'),
    targetAbsolutePath: path.join(sourceRoot, exportDate, uniqueId, '01_html.html'),
  })
  projectDisplayNames.set(project.name, displayName)
}

for (const doc of projectDocs.values()) {
  fs.mkdirSync(path.dirname(doc.targetAbsolutePath), { recursive: true })
  fs.copyFileSync(doc.sourceHtml, doc.targetAbsolutePath)
}

const projectLookup = new Map(
  (graph.projects || []).map(project => {
    const uniqueId = slugify(project.name)
    const displayName = projectDisplayNames.get(project.name) || humanizeSlug(project.name)
    const baseTags = [project.domain, project.subdomain].filter(Boolean)
    const doc = projectDocs.get(uniqueId)
    return [project.name, {
      uniqueId,
      name: displayName,
      summary: project.summary || '',
      domain: project.domain || '',
      subdomain: project.subdomain || '',
      baseTags,
      htmlPath: doc.targetRelativePath.replace(/\\/g, '/'),
    }]
  })
)

const projectSetsByEntity = new Map()
for (const entity of graph.entities || []) {
  projectSetsByEntity.set(
    entity.name,
    new Set((entity.projectRoles || []).map(role => role.project))
  )
}

function buildEntityId(name) {
  return `ent-${slugify(name)}`
}

const driver = neo4j.driver(
  process.env.VITE_NEO4J_URI || 'bolt://127.0.0.1:7687',
  neo4j.auth.basic(
    process.env.VITE_NEO4J_USER || 'neo4j',
    process.env.VITE_NEO4J_PASSWORD || '12345678',
  )
)

const session = driver.session({ database: process.env.VITE_NEO4J_DATABASE || 'memorytonic' })

try {
  const existing = await session.run(
    'MATCH (c:Collection {name: $name}) RETURN count(c) AS count',
    { name: collectionName }
  )
  if ((existing.records[0]?.get('count')?.toNumber?.() || 0) > 0) {
    console.error(`Collection "${collectionName}" already exists.`)
    process.exit(1)
  }

  const tx = session.beginTransaction()

  try {
    await tx.run(
      `MERGE (d:DirectoryCategory {name: $directoryName})
       ON CREATE SET d.description = $directoryDescription`,
      { directoryName, directoryDescription }
    )

    await tx.run(
      `MERGE (c:Collection {name: $collectionName})
       SET c.sourceSlug = $sourceSlug`,
      { collectionName, sourceSlug: rawCollectionSlug }
    )

    await tx.run(
      `MERGE (dt:DateTime {type: 'date', date: $date})`,
      { date: exportDate }
    )

    for (const project of projectLookup.values()) {
      await tx.run(
        `MATCH (c:Collection {name: $collectionName})
         MATCH (d:DirectoryCategory {name: $directoryName})
         MATCH (dt:DateTime {type: 'date', date: $date})
         MERGE (p:Project {uniqueId: $uniqueId})
         SET p.name = $name,
             p.summary = $summary,
             p.domain = $domain,
             p.subdomain = $subdomain,
             p.baseTags = $baseTags,
             p.htmlPath = $htmlPath
         MERGE (p)-[:BELONGS_TO]->(c)
         MERGE (p)-[:IN_DIRECTORY]->(d)
         MERGE (p)-[:CREATED_ON]->(dt)`,
        {
          collectionName,
          directoryName,
          date: exportDate,
          ...project,
        }
      )
    }

    for (const entity of graph.entities || []) {
      await tx.run(
        `MERGE (e:Entity {name: $name})
         ON CREATE SET
           e.entityId = $entityId,
           e.category = $category,
           e.definition = $definition,
           e.aliases = $aliases,
           e.pageRank = $pageRank,
           e.betweenness = $betweenness
         ON MATCH SET
           e.category = CASE WHEN coalesce(e.category, '') = '' THEN $category ELSE e.category END,
           e.definition = CASE WHEN coalesce(e.definition, '') = '' THEN $definition ELSE e.definition END,
           e.aliases = CASE WHEN coalesce(size(e.aliases), 0) = 0 THEN $aliases ELSE e.aliases END,
           e.pageRank = CASE WHEN coalesce(e.pageRank, 0) < $pageRank THEN $pageRank ELSE e.pageRank END,
           e.betweenness = CASE WHEN coalesce(e.betweenness, 0) < $betweenness THEN $betweenness ELSE e.betweenness END`,
        {
          name: entity.name,
          entityId: buildEntityId(entity.name),
          category: entity.category || 'Concept',
          definition: entity.definition || '',
          aliases: entity.aliases || [],
          pageRank: entity.metrics?.pageRank || 0,
          betweenness: entity.metrics?.betweenness || 0,
        }
      )

      for (const role of entity.projectRoles || []) {
        const project = projectLookup.get(role.project)
        if (!project) continue
        await tx.run(
          `MATCH (e:Entity {name: $entityName})
           MATCH (p:Project {uniqueId: $projectUniqueId})
           MERGE (e)-[m:MENTIONED_IN]->(p)
           SET m.role = $role`,
          {
            entityName: entity.name,
            projectUniqueId: project.uniqueId,
            role: role.role || '',
          }
        )
      }
    }

    for (const relationship of graph.relationships || []) {
      const sourceProjects = projectSetsByEntity.get(relationship.source) || new Set()
      const targetProjects = projectSetsByEntity.get(relationship.target) || new Set()
      const commonProjects = [...sourceProjects].filter(projectName => targetProjects.has(projectName))

      for (const projectName of commonProjects) {
        const project = projectLookup.get(projectName)
        if (!project) continue

        await tx.run(
          `MATCH (a:Entity {name: $source})
           MATCH (b:Entity {name: $target})
           MERGE (a)-[r:RELATES_TO {projectId: $projectId, relType: $relType, description: $description}]->(b)
           SET r.causalClassification = $causalClassification,
               r.evidence = $evidence,
               r.evidenceStrength = $evidenceStrength,
               r.magnitude = $magnitude`,
          {
            source: relationship.source,
            target: relationship.target,
            projectId: project.uniqueId,
            relType: relationship.relType || 'RELATED_TO',
            description: relationship.description || '',
            causalClassification: relationship.causalClassification || relationship.relType || 'RELATED_TO',
            evidence: relationship.evidence || '',
            evidenceStrength: relationship.evidenceStrength || '',
            magnitude: relationship.magnitude || '',
          }
        )
      }
    }

    for (const chain of graph.causal_chains || []) {
      const project = projectLookup.get(chain.projectName)
      if (!project) continue

      await tx.run(
        `MATCH (p:Project {uniqueId: $projectUniqueId})
         MERGE (cc:CausalChain {chainId: $chainId})
         SET cc.name = $chainName,
             cc.description = $description
         MERGE (cc)-[:BELONGS_TO_PROJECT]->(p)`,
        {
          projectUniqueId: project.uniqueId,
          chainId: chain.chainId,
          chainName: chain.chainName || humanizeSlug(chain.chainId),
          description: chain.description || '',
        }
      )

      for (const link of chain.links || []) {
        await tx.run(
          `MATCH (a:Entity {name: $source})
           MATCH (b:Entity {name: $target})
           MERGE (a)-[cl:CHAIN_LINK {chainId: $chainId, orderIndex: $orderIndex}]->(b)
           SET cl.explanation = $explanation`,
          {
            source: link.source,
            target: link.target,
            chainId: chain.chainId,
            orderIndex: Number(link.orderIndex || 0),
            explanation: link.explanation || '',
          }
        )
      }
    }

    await tx.run(
      `MATCH (e:Entity)
       OPTIONAL MATCH (e)-[:MENTIONED_IN]->(p:Project)
       WITH e, count(DISTINCT p) AS projectCount
       SET e.projectCount = projectCount`
    )

    await tx.run(
      `MATCH (e:Entity)
       OPTIONAL MATCH (e)--()
       WITH e, count(*) AS degree
       SET e.degree = degree`
    )

    await tx.commit()
  } catch (error) {
    await tx.rollback()
    throw error
  }

  const verify = await session.run(
    `MATCH (c:Collection {name: $collectionName})
     OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c)
     OPTIONAL MATCH (e:Entity)-[:MENTIONED_IN]->(p)
     OPTIONAL MATCH (cc:CausalChain)-[:BELONGS_TO_PROJECT]->(p)
     RETURN count(DISTINCT p) AS projects,
            count(DISTINCT e) AS entities,
            count(DISTINCT cc) AS chains`,
    { collectionName }
  )

  const row = verify.records[0]
  console.log(JSON.stringify({
    collectionName,
    directoryName,
    exportDate,
    projects: row.get('projects').toNumber(),
    entities: row.get('entities').toNumber(),
    chains: row.get('chains').toNumber(),
    sourceRoot,
  }, null, 2))
} finally {
  await session.close()
  await driver.close()
}
