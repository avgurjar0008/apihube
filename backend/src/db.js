import pg from "pg";

const { Pool } = pg;
let pool = null;

function shouldEnableSsl(connectionString) {
  if (!connectionString) return false;
  if (process.env.DB_SSL === "true" || process.env.DB_SSL === "1") return true;
  if (process.env.NODE_ENV === "production") return true;

  const lower = connectionString.toLowerCase();
  // Supabase direct and pooled connection strings always require SSL
  return (
    lower.includes("supabase.co") ||
    lower.includes("supabase.com") ||
    lower.includes("pooler.supabase") ||
    lower.includes("sslmode=require")
  );
}

export function database() {
  if (!process.env.DATABASE_URL) return null;

  if (!pool) {
    const isSsl = shouldEnableSsl(process.env.DATABASE_URL);
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isSsl ? { rejectUnauthorized: false } : false,
      max: Number(process.env.DB_MAX_CONNECTIONS || 20),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    pool.on("error", (err) => {
      console.error("[Database Pool Error]:", err.message);
    });
  }

  return pool;
}

export function requireDatabase(req, res, next) {
  if (!process.env.DATABASE_URL || !database()) {
    return res.status(503).json({
      success: false,
      message: "Database is not configured. Set DATABASE_URL in backend/.env to connect to Supabase."
    });
  }
  next();
}
