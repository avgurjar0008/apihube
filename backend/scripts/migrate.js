import "dotenv/config";
import fs from "fs/promises";
import { database } from "../src/db.js";

async function runMigrations() {
  const db = database();
  if (!db) throw new Error("DATABASE_URL is required to run migrations.");

  try {
    console.log("Running 001_initial.sql...");
    await db.query(await fs.readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8"));
    
    console.log("Running 002_multi_api_keys.sql...");
    await db.query(await fs.readFile(new URL("../migrations/002_multi_api_keys.sql", import.meta.url), "utf8"));

    console.log("Running 003_reviews.sql...");
    await db.query(await fs.readFile(new URL("../migrations/003_reviews.sql", import.meta.url), "utf8"));

    console.log("✅ All database migrations completed successfully.");
  } finally {
    await db.end();
  }
}

runMigrations();
