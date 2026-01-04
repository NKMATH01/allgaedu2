import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use SUPABASE_DATABASE_URL if available, otherwise fall back to DATABASE_URL
const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or SUPABASE_DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Log which database is being used (hide password)
const urlForLog = databaseUrl.replace(/:[^:@]+@/, ':***@');
console.log(`[db] Connecting to: ${urlForLog}`);

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });
