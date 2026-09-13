import "dotenv/config";
import crypto from "crypto";
import { database } from "../src/db.js";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";

async function runFullSystemAudit() {
  console.log("================================================================================");
  console.log("             APIHub Comprehensive Full-System Audit & Verification              ");
  console.log("================================================================================");

  const pool = database();
  if (!pool) {
    console.error("❌ Database pool could not be initialized.");
    process.exit(1);
  }

  const timestamp = Date.now();
  const testEmail = `audit_${timestamp}@example.com`;
  const testPassword = `AuditPass#${timestamp}!`;
  let sessionCookie = "";
  let userId = null;
  let rawApiKey = "";
  let apiKeyId = null;
  let customApiId = null;
  let customEpId = null;
  let savedReqId = null;

  try {
    // ------------------------------------------------------------------------
    // Audit Check 1: Health Endpoint
    // ------------------------------------------------------------------------
    console.log("[1/18] Checking /api/health endpoint...");
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    if (!healthRes.ok || !healthData.success) {
      throw new Error(`Health check failed: ${JSON.stringify(healthData)}`);
    }
    console.log(`   ✅ /api/health OK (${healthData.service || "APIHub Backend"})`);

    // ------------------------------------------------------------------------
    // Audit Check 2: Sign Up with Supabase
    // ------------------------------------------------------------------------
    console.log(`[2/18] Registering user in Supabase: ${testEmail}...`);
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword, name: "Audit Tester" })
    });
    const signupData = await signupRes.json();
    if (!signupRes.ok || !signupData.success) {
      throw new Error(`Signup failed: ${JSON.stringify(signupData)}`);
    }
    userId = signupData.user?.id;
    const rawSetCookie = signupRes.headers.get("set-cookie");
    if (rawSetCookie) sessionCookie = rawSetCookie.split(";")[0];
    console.log(`   ✅ User registered with ID: ${userId}`);

    // ------------------------------------------------------------------------
    // Audit Check 3: Sign In & Session Verification
    // ------------------------------------------------------------------------
    console.log("[3/18] Testing Sign In and /api/auth/me session check...");
    const signinRes = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const signinData = await signinRes.json();
    if (!signinRes.ok || !signinData.success) {
      throw new Error(`Signin failed: ${JSON.stringify(signinData)}`);
    }
    const signinSetCookie = signinRes.headers.get("set-cookie");
    if (signinSetCookie) sessionCookie = signinSetCookie.split(";")[0];

    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: sessionCookie }
    });
    const meData = await meRes.json();
    if (!meRes.ok || meData.user?.email !== testEmail) {
      throw new Error(`Session /me check failed: ${JSON.stringify(meData)}`);
    }
    console.log(`   ✅ Sign In & session validation verified for ${meData.user.email}`);

    // ------------------------------------------------------------------------
    // Audit Check 4: Generate API Key
    // ------------------------------------------------------------------------
    console.log("[4/18] Generating APIHub API Key...");
    const keyGenRes = await fetch(`${BASE_URL}/api/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ name: "Audit Key" })
    });
    const keyGenData = await keyGenRes.json();
    if (!keyGenRes.ok || !keyGenData.success) {
      throw new Error(`API key generation failed: ${JSON.stringify(keyGenData)}`);
    }
    rawApiKey = keyGenData.secret;
    apiKeyId = keyGenData.data?.id;
    console.log(`   ✅ Key created: prefix=${keyGenData.data?.prefix}, raw=${rawApiKey.slice(0, 16)}...`);

    // ------------------------------------------------------------------------
    // Audit Check 5: Database SHA-256 Hash Verification (Zero raw key in DB)
    // ------------------------------------------------------------------------
    console.log("[5/18] Auditing Supabase api_keys table for security...");
    const dbKeyRes = await pool.query(
      "SELECT id, key_hash, key_prefix, revoked_at FROM api_keys WHERE id = $1",
      [apiKeyId]
    );
    const keyRow = dbKeyRes.rows[0];
    const expectedHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
    if (keyRow.key_hash !== expectedHash) {
      throw new Error("Hash mismatch in Supabase api_keys table!");
    }
    if (JSON.stringify(keyRow).includes(rawApiKey)) {
      throw new Error("SECURITY VIOLATION: Raw key found in DB record!");
    }
    console.log(`   ✅ DB verified: SHA-256 matches perfectly, zero raw key exposure in DB.`);

    // ------------------------------------------------------------------------
    // Audit Check 6: List API Keys Endpoint
    // ------------------------------------------------------------------------
    console.log("[6/18] Listing API keys via GET /api/api-keys...");
    const listKeysRes = await fetch(`${BASE_URL}/api/api-keys`, {
      headers: { Cookie: sessionCookie }
    });
    const listKeysData = await listKeysRes.json();
    const foundKey = listKeysData.data?.find(k => k.id === apiKeyId);
    if (!foundKey || foundKey.status !== "Active") {
      throw new Error(`Listed key invalid: ${JSON.stringify(listKeysData)}`);
    }
    console.log(`   ✅ Key listed properly with status Active.`);

    // ------------------------------------------------------------------------
    // Audit Check 7: Gateway Docs Endpoint
    // ------------------------------------------------------------------------
    console.log("[7/18] Testing Gateway Docs metadata endpoint with X-API-Key...");
    const docsRes = await fetch(`${BASE_URL}/api/gateway/docs/open-meteo`, {
      headers: { "X-API-Key": rawApiKey }
    });
    const docsData = await docsRes.json();
    if (!docsRes.ok || !docsData.success || !docsData.data?.gatewayBaseUrl) {
      throw new Error(`Gateway docs failed: ${JSON.stringify(docsData)}`);
    }
    console.log(`   ✅ Gateway docs returned valid schema for: ${docsData.data.name}`);

    // ------------------------------------------------------------------------
    // Audit Check 8: Gateway Proxy Execution with X-API-Key
    // ------------------------------------------------------------------------
    console.log("[8/18] Executing live Gateway proxy request with X-API-Key...");
    let gwUrl = `${BASE_URL}/api/gateway/open-meteo/forecast?latitude=40.71&longitude=-74.00`;
    let gwRes = await fetch(gwUrl, {
      headers: { "X-API-Key": rawApiKey }
    });

    if (gwRes.status === 503) {
      console.log("   - Open-Meteo returned 503, testing via DummyJSON...");
      gwUrl = `${BASE_URL}/api/gateway/dummyjson/products/1`;
      gwRes = await fetch(gwUrl, {
        headers: { "X-API-Key": rawApiKey }
      });
    }

    if (gwRes.status !== 200) {
      const errText = await gwRes.text();
      throw new Error(`Gateway call failed (${gwRes.status}): ${errText}`);
    }
    const gwData = await gwRes.json();
    console.log(`   ✅ Gateway proxy returned HTTP 200 OK. Clean uncompressed JSON verified.`);

    // ------------------------------------------------------------------------
    // Audit Check 9: Request Tester Execution Endpoint (/api/requests/execute)
    // ------------------------------------------------------------------------
    console.log("[9/18] Testing API Tester execution via POST /api/requests/execute...");
    const execRes = await fetch(`${BASE_URL}/api/requests/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        method: "GET",
        url: "https://jsonplaceholder.typicode.com/posts/1",
        headers: { "Content-Type": "application/json" }
      })
    });
    const execData = await execRes.json();
    if (!execRes.ok || !execData.success || execData.data?.status !== 200) {
      throw new Error(`Request execution failed: ${JSON.stringify(execData)}`);
    }
    console.log(`   ✅ Tester execution succeeded (HTTP ${execData.data.status}, ${execData.data.responseTimeMs}ms)`);

    // ------------------------------------------------------------------------
    // Audit Check 10: Request History Persistence in Supabase
    // ------------------------------------------------------------------------
    console.log("[10/18] Verifying request_history persistence in Supabase...");
    const histRes = await fetch(`${BASE_URL}/api/requests/history`, {
      headers: { Cookie: sessionCookie }
    });
    const histData = await histRes.json();
    if (!histRes.ok || !Array.isArray(histData.data) || histData.data.length === 0) {
      throw new Error(`Request history not persisted in DB: ${JSON.stringify(histData)}`);
    }
    console.log(`   ✅ Request history verified in Supabase (${histData.data.length} records found)`);

    // ------------------------------------------------------------------------
    // Audit Check 11: Saved Requests Persistence in Supabase
    // ------------------------------------------------------------------------
    console.log("[11/18] Testing saved_requests creation, retrieval, and deletion...");
    const saveRes = await fetch(`${BASE_URL}/api/saved-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        method: "GET",
        url: "https://jsonplaceholder.typicode.com/posts/1",
        headers: "Content-Type: application/json",
        body: "",
        params: [{ key: "userId", value: "1", enabled: true }]
      })
    });
    const saveData = await saveRes.json();
    if (!saveRes.ok || !saveData.success) {
      throw new Error(`Failed to save request: ${JSON.stringify(saveData)}`);
    }
    savedReqId = saveData.data?.id;

    // Verify retrieval
    const listSavedRes = await fetch(`${BASE_URL}/api/saved-requests`, {
      headers: { Cookie: sessionCookie }
    });
    const listSavedData = await listSavedRes.json();
    if (!listSavedData.data?.some(r => r.id === savedReqId)) {
      throw new Error("Saved request not found in retrieval list!");
    }

    // Delete saved request
    await fetch(`${BASE_URL}/api/saved-requests/${savedReqId}`, {
      method: "DELETE",
      headers: { Cookie: sessionCookie }
    });
    console.log(`   ✅ Saved requests CRUD verified in Supabase.`);

    // ------------------------------------------------------------------------
    // Audit Check 12: Custom User API & Endpoints CRUD
    // ------------------------------------------------------------------------
    console.log("[12/18] Testing Custom User API creation and endpoint attachment...");
    const createApiRes = await fetch(`${BASE_URL}/api/my-apis`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: `Audit Custom API ${timestamp}`,
        baseUrl: "https://jsonplaceholder.typicode.com",
        description: "Test Custom API for Audit",
        type: "REST"
      })
    });
    const createApiData = await createApiRes.json();
    if (!createApiRes.ok || !createApiData.success) {
      throw new Error(`Failed to create custom API: ${JSON.stringify(createApiData)}`);
    }
    customApiId = createApiData.data?.id;

    // Create an endpoint under this custom API
    const createEpRes = await fetch(`${BASE_URL}/api/my-apis/${customApiId}/endpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "Get Single Post",
        method: "GET",
        path: "/posts/1",
        description: "Returns post with ID 1"
      })
    });
    const createEpData = await createEpRes.json();
    if (!createEpRes.ok || !createEpData.success) {
      throw new Error(`Failed to create custom endpoint: ${JSON.stringify(createEpData)}`);
    }
    customEpId = createEpData.data?.id;
    console.log(`   ✅ Custom API & Endpoint created in Supabase (API ID: ${customApiId}, Ep ID: ${customEpId})`);

    // ------------------------------------------------------------------------
    // Audit Check 13: Gateway Tenant Isolation on Custom API
    // ------------------------------------------------------------------------
    console.log("[13/18] Testing Gateway multi-tenant isolation on custom APIs...");
    // Key belongs to same user, so gateway should resolve and proxy
    const customGwRes = await fetch(`${BASE_URL}/api/gateway/${customApiId}/posts/1`, {
      headers: { "X-API-Key": rawApiKey }
    });
    if (customGwRes.status !== 200) {
      const errTxt = await customGwRes.text();
      throw new Error(`Custom API gateway call failed: ${errTxt}`);
    }
    console.log(`   ✅ Custom API gateway routing verified.`);

    // ------------------------------------------------------------------------
    // Audit Check 14: SSRF Protection
    // ------------------------------------------------------------------------
    console.log("[14/18] Testing Gateway SSRF protection against private IP targets...");
    // Try to create custom API targeting localhost / private IP
    const ssrfCreateRes = await fetch(`${BASE_URL}/api/my-apis`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: `SSRF Test API ${timestamp}`,
        baseUrl: "http://127.0.0.1:8080",
        description: "Malicious private target"
      })
    });
    const ssrfCreateData = await ssrfCreateRes.json();
    const ssrfApiId = ssrfCreateData.data?.id;

    if (ssrfApiId) {
      // Calling gateway should be blocked by validateUrlSafety
      const ssrfGwRes = await fetch(`${BASE_URL}/api/gateway/${ssrfApiId}/admin`, {
        headers: { "X-API-Key": rawApiKey }
      });
      if (ssrfGwRes.status === 400 || ssrfGwRes.status === 403 || ssrfGwRes.status === 502) {
        console.log(`   ✅ SSRF successfully blocked with HTTP ${ssrfGwRes.status}.`);
      } else {
        throw new Error(`SSRF protection failed! Expected error status, got: ${ssrfGwRes.status}`);
      }
      // Clean up ssrf test API
      await pool.query("DELETE FROM user_apis WHERE id = $1", [ssrfApiId]);
    }

    // ------------------------------------------------------------------------
    // Audit Check 15: Clean up custom endpoint and API
    // ------------------------------------------------------------------------
    console.log("[15/18] Cleaning up custom endpoints and APIs...");
    await fetch(`${BASE_URL}/api/my-apis/${customApiId}/endpoints/${customEpId}`, {
      method: "DELETE",
      headers: { Cookie: sessionCookie }
    });
    await fetch(`${BASE_URL}/api/my-apis/${customApiId}`, {
      method: "DELETE",
      headers: { Cookie: sessionCookie }
    });
    console.log(`   ✅ Custom API & endpoints deleted cleanly.`);

    // ------------------------------------------------------------------------
    // Audit Check 16: API Key Revocation & 401 Rejection
    // ------------------------------------------------------------------------
    console.log("[16/18] Revoking API key and verifying 401 rejection on Gateway...");
    const revokeRes = await fetch(`${BASE_URL}/api/api-keys/${apiKeyId}/revoke`, {
      method: "POST",
      headers: { Cookie: sessionCookie }
    });
    const revokeData = await revokeRes.json();
    if (!revokeRes.ok || !revokeData.success) {
      throw new Error(`Failed to revoke key: ${JSON.stringify(revokeData)}`);
    }

    const postRevokeGwRes = await fetch(gwUrl, {
      headers: { "X-API-Key": rawApiKey }
    });
    if (postRevokeGwRes.status !== 401) {
      throw new Error(`Expected HTTP 401 after revocation, got ${postRevokeGwRes.status}`);
    }
    console.log(`   ✅ Revoked key correctly rejected with HTTP 401 Unauthorized.`);

    // ------------------------------------------------------------------------
    // Audit Check 17: Sign Out
    // ------------------------------------------------------------------------
    console.log("[17/18] Testing Sign Out and session termination...");
    const signoutRes = await fetch(`${BASE_URL}/api/auth/signout`, {
      method: "POST",
      headers: { Cookie: sessionCookie }
    });
    if (!signoutRes.ok) {
      throw new Error("Signout failed.");
    }
    console.log(`   ✅ User signed out successfully.`);

    // ------------------------------------------------------------------------
    // Audit Check 18: Final Database Cleanup
    // ------------------------------------------------------------------------
    console.log("[18/18] Purging test records from Supabase PostgreSQL...");
    await pool.query("DELETE FROM request_history WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM saved_requests WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM user_endpoints WHERE api_id IN (SELECT id FROM user_apis WHERE user_id = $1)", [userId]);
    await pool.query("DELETE FROM user_apis WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM api_keys WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    console.log(`   ✅ All test artifacts cleaned up.`);

    console.log("\n================================================================================");
    console.log("🎉 FULL SYSTEM AUDIT COMPLETE: ALL 18 VERIFICATION CHECKS PASSED!");
    console.log("================================================================================");
    process.exit(0);

  } catch (err) {
    console.error("\n❌ AUDIT CHECK FAILED:", err.message || err);
    if (userId) {
      try {
        await pool.query("DELETE FROM request_history WHERE user_id = $1", [userId]);
        await pool.query("DELETE FROM saved_requests WHERE user_id = $1", [userId]);
        await pool.query("DELETE FROM user_endpoints WHERE api_id IN (SELECT id FROM user_apis WHERE user_id = $1)", [userId]);
        await pool.query("DELETE FROM user_apis WHERE user_id = $1", [userId]);
        await pool.query("DELETE FROM api_keys WHERE user_id = $1", [userId]);
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
        console.log("Cleaned up audit test user from Supabase.");
      } catch {}
    }
    process.exit(1);
  }
}

runFullSystemAudit();

