import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// CRITICAL: Use SUPABASE_DATABASE_URL ONLY - no fallback to Replit DB
const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "SUPABASE_DATABASE_URL must be set. This application requires Supabase database exclusively.",
  );
}

// Validate it's actually a Supabase URL
if (!databaseUrl.includes('supabase')) {
  console.warn('[db] WARNING: Database URL does not appear to be Supabase. Ensure SUPABASE_DATABASE_URL is correct.');
}

// Log which database is being used (hide password)
const urlForLog = databaseUrl.replace(/:[^:@]+@/, ':***@');
console.log(`[db] Connecting to Supabase: ${urlForLog}`);

export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

export const db = drizzle(pool, { schema });
