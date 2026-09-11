import pg from "pg";

const { Pool } = pg;
let pool;

export function database() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false });
  return pool;
}

export function requireDatabase(req, res, next) {
  if (!database()) return res.status(503).json({ success: false, message: "Database is not configured. Set DATABASE_URL to enable accounts and private data." });
  next();
}
