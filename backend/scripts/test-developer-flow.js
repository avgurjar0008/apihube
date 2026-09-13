import "dotenv/config";
import crypto from "crypto";
import { database } from "../src/db.js";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";

async function runDeveloperFlowTest() {
  console.log("==========================================================");
  console.log("      APIHub Developer API-Key & Gateway Lifecycle Test    ");
  console.log("==========================================================");

  const pool = database();
  if (!pool) {
    console.error("❌ Database pool could not be initialized. Check DATABASE_URL.");
    process.exit(1);
  }

  const timestamp = Date.now();
  const testEmail = `devtest_${timestamp}@example.com`;
  const testPassword = `Pass#${timestamp}!`;
  let sessionCookie = "";
  let userId = null;
  let rawApiKey = "";
  let apiKeyId = null;

  try {
    // ------------------------------------------------------------------------
    // Step 1: Sign Up
    // ------------------------------------------------------------------------
    console.log(`\n[Step 1] Registering new developer user: ${testEmail}...`);
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });

    const signupData = await signupRes.json();
    if (!signupRes.ok || !signupData.success) {
      throw new Error(`Sign up failed: ${JSON.stringify(signupData)}`);
    }

    userId = signupData.user?.id;
    // Extract session cookie from Set-Cookie header
    const rawSetCookie = signupRes.headers.get("set-cookie");
    if (rawSetCookie) {
      sessionCookie = rawSetCookie.split(";")[0];
    }
    console.log(`✅ User registered successfully. User ID: ${userId}`);

    // ------------------------------------------------------------------------
    // Step 2: Sign In (verify auth credentials & session)
    // ------------------------------------------------------------------------
    console.log("\n[Step 2] Signing in with user credentials...");
    const signinRes = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });

    const signinData = await signinRes.json();
    if (!signinRes.ok || !signinData.success) {
      throw new Error(`Sign in failed: ${JSON.stringify(signinData)}`);
    }

    const signinSetCookie = signinRes.headers.get("set-cookie");
    if (signinSetCookie) {
      sessionCookie = signinSetCookie.split(";")[0];
    }
    console.log(`✅ User signed in successfully. Session cookie obtained.`);

    // ------------------------------------------------------------------------
    // Step 3: Generate API Key
    // ------------------------------------------------------------------------
    console.log("\n[Step 3] Generating developer API key via POST /api/api-keys...");
    const keyGenRes = await fetch(`${BASE_URL}/api/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie
      },
      body: JSON.stringify({ name: "Lifecycle Automated Test Key" })
    });

    const keyGenData = await keyGenRes.json();
    if (!keyGenRes.ok || !keyGenData.success) {
      throw new Error(`API key generation failed: ${JSON.stringify(keyGenData)}`);
    }

    rawApiKey = keyGenData.secret;
    apiKeyId = keyGenData.data?.id;

    if (!rawApiKey || !rawApiKey.startsWith("ah_live_")) {
      throw new Error(`Invalid raw API key format returned: ${rawApiKey}`);
    }

    console.log(`✅ API Key generated successfully.`);
    console.log(`   - Key ID     : ${apiKeyId}`);
    console.log(`   - Key Prefix : ${keyGenData.data?.prefix}`);
    console.log(`   - Raw Secret : ${rawApiKey.slice(0, 16)}... (shown once)`);

    // ------------------------------------------------------------------------
    // Step 4: Verify Database Storage (Security Check)
    // ------------------------------------------------------------------------
    console.log("\n[Step 4] Verifying database security & SHA-256 hash storage...");
    const dbRowRes = await pool.query(
      "SELECT id, user_id, key_prefix, key_hash, revoked_at FROM api_keys WHERE id = $1",
      [apiKeyId]
    );

    if (dbRowRes.rows.length === 0) {
      throw new Error(`API key record ${apiKeyId} not found in database!`);
    }

    const dbRecord = dbRowRes.rows[0];
    const expectedHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");

    if (dbRecord.key_hash !== expectedHash) {
      throw new Error(
        `Hash mismatch! DB has ${dbRecord.key_hash}, expected SHA-256 is ${expectedHash}`
      );
    }

    // Crucial check: raw secret must NOT appear anywhere in the database row
    const tableDump = JSON.stringify(dbRecord);
    if (tableDump.includes(rawApiKey)) {
      throw new Error("SECURITY VIOLATION: Raw API key found stored in database!");
    }

    if (dbRecord.revoked_at !== null) {
      throw new Error("Expected newly generated key to have revoked_at === null");
    }

    console.log(`✅ Security check passed:`);
    console.log(`   - Stored Hash (SHA-256) : ${dbRecord.key_hash}`);
    console.log(`   - Hash Match Verified   : TRUE`);
    console.log(`   - Raw Secret in DB      : NONE (Zero exposure)`);
    console.log(`   - Key Status            : Active (revoked_at is NULL)`);

    // ------------------------------------------------------------------------
    // Step 5: Query APIHub Gateway with X-API-Key
    // ------------------------------------------------------------------------
    console.log("\n[Step 5] Calling APIHub Gateway using X-API-Key header...");
    let gatewayUrl = `${BASE_URL}/api/gateway/open-meteo/forecast?latitude=40.71&longitude=-74.00`;
    let gwRes = await fetch(gatewayUrl, {
      method: "GET",
      headers: {
        "X-API-Key": rawApiKey
      }
    });

    // If upstream open-meteo returns 503 service overloaded, test gateway via jsonplaceholder
    if (gwRes.status === 503) {
      console.log("   - Upstream Open-Meteo free tier returned 503 (service overloaded). Falling back to JSONPlaceholder gateway endpoint...");
      gatewayUrl = `${BASE_URL}/api/gateway/jsonplaceholder/posts/1`;
      gwRes = await fetch(gatewayUrl, {
        method: "GET",
        headers: { "X-API-Key": rawApiKey }
      });
    }

    console.log(`   - Gateway HTTP Status: ${gwRes.status}`);
    if (gwRes.status !== 200) {
      const errText = await gwRes.text();
      throw new Error(`Gateway call failed with status ${gwRes.status}: ${errText}`);
    }

    const gwData = await gwRes.json();
    console.log(`✅ Gateway request succeeded!`);
    console.log(`   - Gateway Endpoint Verified: ${gatewayUrl}`);
    console.log(`   - Response sample: ${JSON.stringify(gwData).slice(0, 80)}...`);
    console.log(`   - Compression/Decoding Check: Clean JSON parsed with zero Z_DATA_ERROR.`);

    // ------------------------------------------------------------------------
    // Step 6: Revoke the API Key
    // ------------------------------------------------------------------------
    console.log(`\n[Step 6] Revoking API key ${apiKeyId}...`);
    const revokeRes = await fetch(`${BASE_URL}/api/api-keys/${apiKeyId}/revoke`, {
      method: "POST",
      headers: { Cookie: sessionCookie }
    });

    const revokeData = await revokeRes.json();
    if (!revokeRes.ok || !revokeData.success) {
      throw new Error(`Revocation failed: ${JSON.stringify(revokeData)}`);
    }

    // Verify revoked_at in DB
    const revokedDbRes = await pool.query(
      "SELECT revoked_at FROM api_keys WHERE id = $1",
      [apiKeyId]
    );
    if (!revokedDbRes.rows[0]?.revoked_at) {
      throw new Error("Expected revoked_at timestamp in database after revocation.");
    }
    console.log(`✅ Key revoked successfully. Revoked timestamp: ${revokedDbRes.rows[0].revoked_at}`);

    // ------------------------------------------------------------------------
    // Step 7: Verify Gateway Rejects Revoked Key (HTTP 401)
    // ------------------------------------------------------------------------
    console.log("\n[Step 7] Calling Gateway again with revoked key (should be rejected)...");
    const gwRevokedRes = await fetch(gatewayUrl, {
      method: "GET",
      headers: {
        "X-API-Key": rawApiKey
      }
    });

    console.log(`   - Gateway HTTP Status: ${gwRevokedRes.status}`);
    const revokedGwBody = await gwRevokedRes.json();
    console.log(`   - Gateway Response   : ${JSON.stringify(revokedGwBody)}`);

    if (gwRevokedRes.status !== 401) {
      throw new Error(`Expected HTTP 401 for revoked key, got ${gwRevokedRes.status}`);
    }

    console.log(`✅ Access correctly denied for revoked key!`);

    // ------------------------------------------------------------------------
    // Step 8: Clean up test artifacts
    // ------------------------------------------------------------------------
    console.log("\n[Step 8] Cleaning up test records from database...");
    await pool.query("DELETE FROM api_keys WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    console.log(`✅ Cleaned up test user and keys.`);

    console.log("\n==========================================================");
    console.log("🎉 ALL TESTS PASSED: Full developer lifecycle verified!");
    console.log("==========================================================");
    process.exit(0);

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message || err);
    if (userId) {
      try {
        await pool.query("DELETE FROM api_keys WHERE user_id = $1", [userId]);
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
        console.log("Cleaned up test user after failure.");
      } catch {}
    }
    process.exit(1);
  }
}

runDeveloperFlowTest();

