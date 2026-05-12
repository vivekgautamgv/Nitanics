import neo4j, { type Driver, type Session, type ManagedTransaction } from 'neo4j-driver';
import { config } from '../config.js';

let driver: Driver | null = null;

function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(config.neo4j_uri, neo4j.auth.basic(config.neo4j_user, config.neo4j_password));
  }
  return driver;
}

function getDatabase(): string {
  return config.neo4j_database;
}

/** Recursively convert neo4j integers and nested objects to plain JS values */
function toPlainValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (neo4j.isInt(value)) return value.toNumber();
  if (typeof value === 'object' && value !== null && 'low' in value && 'high' in value) {
    return neo4j.integer.toNumber(value as neo4j.Integer);
  }
  if (Array.isArray(value)) return value.map(toPlainValue);
  if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = toPlainValue(v);
    }
    return result;
  }
  return value;
}

function toPlain(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = toPlainValue(value);
  }
  return result;
}

export async function runRead<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const session: Session = getDriver().session({ database: getDatabase() });
  try {
    const result = await session.executeRead(async (tx: ManagedTransaction) => {
      const res = await tx.run(cypher, params);
      return res.records.map(r => toPlain(r.toObject()) as T);
    });
    return result;
  } finally {
    await session.close();
  }
}

export async function runWrite<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const session: Session = getDriver().session({ database: getDatabase() });
  try {
    const result = await session.executeWrite(async (tx: ManagedTransaction) => {
      const res = await tx.run(cypher, params);
      return res.records.map(r => toPlain(r.toObject()) as T);
    });
    return result;
  } finally {
    await session.close();
  }
}

export async function verifyConnection(): Promise<boolean> {
  try {
    await runRead('RETURN 1 AS ok');
    return true;
  } catch {
    return false;
  }
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
