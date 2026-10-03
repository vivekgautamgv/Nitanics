// Read-only check of the existing MCP recall implementation. Never prints credentials.
import fs from 'node:fs';
import path from 'node:path';
const root = 'D:/MT-v4';
const work = path.dirname(import.meta.path);
const values: Record<string,string> = {};
for (const line of fs.readFileSync(path.join(root,'apps/web/frontend/.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
}
for (const suffix of ['URI','USER','PASSWORD','DATABASE']) {
  const value = values['VITE_NEO4J_'+suffix];
  if (!value) throw new Error('Explicit local database configuration is required for this read-only check.');
  process.env['NEO4J_'+suffix] = value;
}
const { graphRAGRecall, getEntity } = await import(root+'/apps/mcp/src/neo4j/queries.ts');
const { closeDriver, runRead } = await import(root+'/apps/mcp/src/neo4j/driver.ts');
try {
  let recallStatus;
  try {
    const recalled = await graphRAGRecall('"Federal Reserve"',1,3);
    recallStatus = {status:'passed',entities:recalled.entities.length};
  } catch (error) {
    recallStatus = {status:'failed',code:(error as any)?.code,
      detail:'Neo4j rejected a JS numeric LIMIT as a floating-point value; repository source was preserved.'};
  }
  const entity = await getEntity('Federal Reserve');
  if (!entity) throw new Error('The entity lookup returned no context.');
  const focused = await runRead(`MATCH (e:Entity {name:$name})-[m:MENTIONED_IN]->(p:Project)
    MATCH (p)-[:BELONGS_TO]->(c:Collection {name:$collection})
    RETURN e.name AS entity, e.category AS category, p.name AS source, m.role AS role
    ORDER BY source LIMIT 3`,{name:'Federal Reserve',collection:'Global Finance Systems'});
  if (!focused.length) throw new Error('The focused query returned no context.');
  fs.writeFileSync(path.join(work,'verified-entity-context.json'),JSON.stringify(entity,null,2));
  fs.writeFileSync(path.join(work,'verified-focused-context.json'),JSON.stringify(focused,null,2));
  const report = {status:'read-only graph context retrieval passed',
    entityLookup:{entity:'Federal Reserve',returnedFields:Object.keys(entity)},
    focusedQuery:{entity:'Federal Reserve',collection:'Global Finance Systems',sourceRows:focused.length,
      returnedFields:Object.keys(focused[0]),includesCompleteRawSources:false},
    recallCheck:recallStatus,tokenBenchmark:'not performed; no percent or billing savings claim'};
  fs.writeFileSync(path.join(work,'retrieval-check.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} catch (error) {
  let detail = error instanceof Error ? error.message : 'unknown error';
  for (const key of ['NEO4J_PASSWORD','NEO4J_USER','NEO4J_URI','NEO4J_DATABASE']) {
    const value = process.env[key];
    if (value) detail = detail.split(value).join('[local configuration]');
  }
  console.error(JSON.stringify({status:'read-only recall failed',code:(error as any)?.code,
    detail:detail.slice(0,1500)}));
  process.exitCode = 1;
} finally {
  await closeDriver();
}
