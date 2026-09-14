import "dotenv/config";
import { database } from "../src/db.js";

async function verifyDatabase() {
  console.log("==================================================");
  console.log("        APIHub Database Connection Verification   ");
  console.log("==================================================");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ ERROR: DATABASE_URL is not set in backend/.env.");
    console.log("👉 Please copy your Supabase connection string to backend/.env");
    console.log("   Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres");
    process.exit(1);
  }

  // Mask sensitive parts of the URL for safe logging
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":****@");
  console.log(`Connecting to: ${maskedUrl}`);

  const pool = database();
  if (!pool) {
    console.error("❌ ERROR: Failed to initialize database pool.");
    process.exit(1);
  }

  try {
    const started = Date.now();
    const infoResult = await pool.query("SELECT current_database() as db, version() as ver, now() as server_time;");
    const latency = Date.now() - started;

    console.log("✅ Connection established successfully!");
    console.log(`   - Connected Database : ${infoResult.rows[0].db}`);
    console.log(`   - Server Time        : ${infoResult.rows[0].server_time}`);
    console.log(`   - Round-trip Latency : ${latency}ms`);
    console.log(`   - PostgreSQL Version : ${infoResult.rows[0].ver.split(" on ")[0]}`);
    console.log("--------------------------------------------------");

    // Check tables
    const expectedTables = [
      "users",
      "api_keys",
      "user_apis",
      "user_endpoints",
      "saved_requests",
      "request_history",
      "gateway_usage",
      "reviews"
    ];

    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const existingTables = new Set(tablesResult.rows.map(r => r.table_name));

    console.log("Table Status Check:");
    let missingCount = 0;

    for (const table of expectedTables) {
      if (existingTables.has(table)) {
        const countRes = await pool.query(`SELECT count(*)::int as count FROM public.${table};`).catch(() => ({ rows: [{ count: "?" }] }));
        console.log(`   ✅ Table '${table}' exists (rows: ${countRes.rows[0].count})`);
      } else {
        console.log(`   ⚠️ Table '${table}' is MISSING`);
        missingCount++;
      }
    }

    console.log("--------------------------------------------------");
    if (missingCount === 0) {
      console.log("🎉 All APIHub tables are present and ready in Supabase!");
    } else {
      console.log(`⚠️  ${missingCount} table(s) missing.`);
      console.log("👉 Run migration using: npm run migrate");
      console.log("👉 Or run backend/supabase_schema.sql in the Supabase SQL Editor.");
    }
  } catch (err) {
    console.error("\n❌ Database Connection Failed:");
    console.error(`   Message: ${err.message}`);
    if (err.code) console.error(`   Postgres Code: ${err.code}`);
    if (err.message.includes("password authentication failed")) {
      console.error("\n💡 Tip: Your Supabase database password in DATABASE_URL might be incorrect.");
    } else if (err.message.includes("SSL")) {
      console.error("\n💡 Tip: Supabase requires SSL. Ensure DB_SSL=true or sslmode=require in the connection URL.");
    } else if (err.message.includes("ENOTFOUND") || err.message.includes("getaddrinfo")) {
      console.error("\n💡 Tip: Hostname could not be resolved. If on IPv4, use the Supabase Pooler connection string.");
    }
  } finally {
    await pool.end();
  }
}

verifyDatabase().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});

