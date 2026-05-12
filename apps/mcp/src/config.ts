/**
 * Centralized config — reads from env vars → ~/.memorytonic/config.json → defaults.
 * Single source of truth for all paths and credentials.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

interface MemoryTonicConfig {
  neo4j_uri: string;
  neo4j_user: string;
  neo4j_password: string;
  neo4j_database: string;
  c01_dir: string;
  skills_dir: string;
}

function loadConfig(): MemoryTonicConfig {
  let fileConfig: Record<string, string> = {};
  try {
    const configPath = path.join(os.homedir(), '.memorytonic', 'config.json');
    if (fs.existsSync(configPath)) {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch { /* ignore parse errors */ }

  return {
    neo4j_uri: process.env.NEO4J_URI || fileConfig.neo4j_uri || 'neo4j://127.0.0.1:7687',
    neo4j_user: process.env.NEO4J_USER || fileConfig.neo4j_user || 'neo4j',
    neo4j_password: process.env.NEO4J_PASSWORD || fileConfig.neo4j_password || 'memorytonic',
    neo4j_database: process.env.NEO4J_DATABASE || fileConfig.neo4j_database || 'memorytonic',
    c01_dir: process.env.C01_DIR || fileConfig.c01_dir || path.resolve('../../apps/ingestion-pipeline'),
    skills_dir: process.env.SKILLS_DIR || fileConfig.skills_dir || path.resolve('./skills'),
  };
}

export const config = loadConfig();
