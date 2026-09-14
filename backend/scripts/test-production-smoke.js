/**
 * APIHub Production Smoke Test Suite
 * Tests the live deployed Render backend (https://apihub-1-i6r7.onrender.com)
 * and live deployed Vercel frontend (https://apihube.vercel.app)
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BACKEND_URL = "https://apihub-1-i6r7.onrender.com";
const FRONTEND_URL = "https://apihube.vercel.app";

async function runProductionSmokeTests() {
  console.log("===================================================================");
  console.log("             APIHub LIVE PRODUCTION SMOKE TEST SUITE               ");
  console.log("===================================================================");
  console.log(`Live Backend  : ${BACKEND_URL}`);
  console.log(`Live Frontend : ${FRONTEND_URL}`);
  console.log("-------------------------------------------------------------------\n");

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      testPassed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      testFailed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Health Check
  console.log("[1] Checking Render Backend Health (/api/health)...");
  const healthRes = await fetch(`${BACKEND_URL}/api/health`);
  assert(healthRes.ok, `Health endpoint returned status ${healthRes.status}`);
  const healthData = await healthRes.json();
  assert(healthData.success === true, "Health success is true");
  assert(healthData.service === "APIHub Backend", "Service is APIHub Backend");
  assert(healthData.status === "healthy", "Status is healthy");
  console.log(`    Timestamp: ${healthData.timestamp}`);

  // 2. Frontend Check
  console.log("\n[2] Checking Vercel Frontend (https://apihube.vercel.app/)...");
  const feRes = await fetch(FRONTEND_URL);
  assert(feRes.ok, `Frontend returned status ${feRes.status}`);
  const feHtml = await feRes.text();
  assert(feHtml.includes('<div id="root"></div>'), "Frontend HTML contains root mounting container");
  assert(feHtml.includes('APIHub — Explore, Test and Manage APIs'), "Frontend HTML contains title");
  assert(feHtml.includes('assets/index-'), "Frontend HTML links to Vite bundle assets");

  // 3. Authentication & User Profile
  const testEmail = `prod_test_${Date.now()}@example.com`;
  const testPassword = "Password123!Secure";
  const testName = "Production Tester";
  let sessionCookie = "";

  console.log(`\n[3] Testing Sign Up on Production Backend (${testEmail})...`);
  const signupRes = await fetch(`${BACKEND_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword, name: testName })
  });
  if (signupRes.status !== 201) {
    const errText = await signupRes.text();
    console.error("    Sign Up Response Body:", errText);
  }
  assert(signupRes.status === 201, `Sign Up returned status 201 (got ${signupRes.status})`);
  const signupData = await signupRes.json();
  assert(signupData.success === true, "Sign Up success is true");
  assert(signupData.user && signupData.user.email === testEmail, "User email returned correctly");
  assert(signupData.user.name === testName, `User name saved correctly: ${signupData.user.name}`);

  // Capture session cookie
  const setCookie = signupRes.headers.get("set-cookie");
  if (setCookie) {
    sessionCookie = setCookie.split(";")[0];
  }

  console.log(`    User registered: ID=${signupData.user.id}, Name="${signupData.user.name}"`);

  // Sign In test
  console.log("\n[4] Testing Sign In (/api/auth/signin)...");
  const signinRes = await fetch(`${BACKEND_URL}/api/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  assert(signinRes.ok, `Sign In returned status ${signinRes.status}`);
  const signinData = await signinRes.json();
  assert(signinData.success === true, "Sign In success is true");
  assert(signinData.user.name === testName, "Profile contains user name");
  const signinCookie = signinRes.headers.get("set-cookie");
  if (signinCookie) sessionCookie = signinCookie.split(";")[0];

  // Session check (/api/auth/me)
  console.log("\n[5] Testing Session Verification (/api/auth/me)...");
  const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { "Cookie": sessionCookie }
  });
  assert(meRes.ok, `/api/auth/me returned status ${meRes.status}`);
  const meData = await meRes.json();
  assert(meData.success === true, "Session is valid");
  assert(meData.user.name === testName, "Authenticated profile has name for dashboard greeting");

  // 4. API Key Generation (Scoped & Global)
  console.log("\n[6] Generating Scoped API Key (Open-Meteo Weather)...");
  const scopedKeyRes = await fetch(`${BACKEND_URL}/api/api-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": sessionCookie
    },
    body: JSON.stringify({
      name: "Weather Client Key",
      apiSlug: "open-meteo",
      apiName: "Open-Meteo Weather",
      category: "Weather & Climate"
    })
  });
  assert(scopedKeyRes.status === 201, `Scoped key creation returned 201 (got ${scopedKeyRes.status})`);
  const scopedKeyData = await scopedKeyRes.json();
  assert(scopedKeyData.success === true, "Scoped key creation success is true");
  assert(scopedKeyData.secret.startsWith("ah_live_"), "Raw key format is ah_live_...");
  const scopedRawKey = scopedKeyData.secret;
  const scopedKey = scopedKeyData.data || scopedKeyData.key;
  const scopedKeyId = scopedKey.id;
  console.log(`    Scoped Key Created: ID=${scopedKeyId}, Prefix=${scopedKey.keyPrefix || scopedKey.prefix}`);

  console.log("\n[7] Generating Global API Key (All 18 Categories)...");
  const globalKeyRes = await fetch(`${BACKEND_URL}/api/api-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": sessionCookie
    },
    body: JSON.stringify({
      name: "Global Master Key",
      apiSlug: "all",
      apiName: "All APIs (Full Access)",
      category: "All Categories"
    })
  });
  assert(globalKeyRes.status === 201, `Global key creation returned 201`);
  const globalKeyData = await globalKeyRes.json();
  const globalRawKey = globalKeyData.secret;
  const globalKey = globalKeyData.data || globalKeyData.key;
  console.log(`    Global Key Created: ID=${globalKey.id}, Prefix=${globalKey.keyPrefix || globalKey.prefix}`);

  // 5. Gateway Scope Enforcement & Real Data Tests
  console.log("\n[8] Testing Gateway Call to Open-Meteo with Scoped Key...");
  const weatherRes = await fetch(`${BACKEND_URL}/api/gateway/open-meteo/forecast?latitude=40.71&longitude=-74.00`, {
    headers: { "X-API-Key": scopedRawKey }
  });
  assert(weatherRes.status === 200, `Open-Meteo returned status 200 (got ${weatherRes.status})`);
  const weatherData = await weatherRes.json();
  assert(weatherData.latitude !== undefined, "Real weather data returned");
  console.log(`    Open-Meteo Data: Lat=${weatherData.latitude}, Lon=${weatherData.longitude}`);

  console.log("\n[9] Testing Scope Restriction: Calling Binance (Crypto) with Open-Meteo Scoped Key (Expect 403)...");
  const blockedRes = await fetch(`${BACKEND_URL}/api/gateway/binance`, {
    headers: { "X-API-Key": scopedRawKey }
  });
  assert(blockedRes.status === 403, `Unauthorized category blocked with 403 (got ${blockedRes.status})`);
  const blockedData = await blockedRes.json();
  assert(blockedData.success === false, "Success is false");
  console.log(`    Message: ${blockedData.message}`);

  console.log("\n[10] Testing Gateway Call to Binance with Global Key (Expect 200 or upstream 451)...");
  const binanceRes = await fetch(`${BACKEND_URL}/api/gateway/binance`, {
    headers: { "X-API-Key": globalRawKey }
  });
  assert(binanceRes.status === 200 || binanceRes.status === 451, `Binance gateway call succeeded (status ${binanceRes.status})`);
  const binanceData = await binanceRes.json();
  if (binanceRes.status === 200) {
    assert(binanceData.symbol === "BTCUSDT" || binanceData.price !== undefined, "Real Binance data returned");
    console.log(`    Binance Data: Symbol=${binanceData.symbol}, Price=$${binanceData.price}`);
  } else {
    console.log(`    Binance Upstream: ${binanceData.msg || "Service unavailable from US cloud datacenter region"}`);
  }

  console.log("\n[10b] Testing Gateway Call to Frankfurter Currency FX with Global Key (Expect 200)...");
  const fxRes = await fetch(`${BACKEND_URL}/api/gateway/frankfurter/latest?from=USD&to=EUR`, {
    headers: { "X-API-Key": globalRawKey }
  });
  assert(fxRes.status === 200, `Frankfurter FX returned status 200 (got ${fxRes.status})`);
  const fxData = await fxRes.json();
  assert(fxData.rates && fxData.rates.EUR !== undefined, "Real exchange rates returned");
  console.log(`    Frankfurter FX: 1 USD = ${fxData.rates.EUR} EUR`);

  console.log("\n[11] Testing Gateway Call to World Bank (Countries) with Global Key (Expect 200)...");
  const worldBankRes = await fetch(`${BACKEND_URL}/api/gateway/world-bank/country/IND?format=json`, {
    headers: { "X-API-Key": globalRawKey }
  });
  assert(worldBankRes.status === 200, `World Bank returned status 200 (got ${worldBankRes.status})`);
  const wbData = await worldBankRes.json();
  assert(Array.isArray(wbData), "World Bank returned valid JSON array");
  console.log(`    World Bank Country: ${wbData[1]?.[0]?.name || "India"}`);

  // 6. Tester Proxy Execution (/api/requests/execute)
  console.log("\n[12] Testing Request Execution Proxy (/api/requests/execute)...");
  const execRes = await fetch(`${BACKEND_URL}/api/requests/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": sessionCookie
    },
    body: JSON.stringify({
      method: "GET",
      url: "https://jsonplaceholder.typicode.com/posts/1",
      headers: { "Content-Type": "application/json" }
    })
  });
  assert(execRes.ok, `Execute proxy returned status ${execRes.status}`);
  const execData = await execRes.json();
  assert(execData.success === true, "Execute proxy returned success");
  assert(execData.data.status === 200, "Target request executed with status 200");
  console.log(`    Latency: ${execData.data.responseTimeMs}ms, Size: ${execData.data.responseSizeBytes}B`);

  // 7. AI Assistant Endpoint
  console.log("\n[13] Testing AI Learning Assistant (/api/ai/ask)...");
  const aiRes = await fetch(`${BACKEND_URL}/api/ai/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Explain how APIHub API keys are hashed with SHA-256."
    })
  });
  assert(aiRes.ok, `AI endpoint returned status ${aiRes.status}`);
  const aiData = await aiRes.json();
  assert(aiData.success === true, "AI response success is true");
  assert(aiData.text && aiData.text.length > 20, "AI returned comprehensive explanation");
  console.log(`    AI snippet: ${aiData.text.slice(0, 100)}...`);

  // 8. Key Revocation Test
  console.log("\n[14] Testing Key Revocation (/api/api-keys/:id/revoke)...");
  const revokeRes = await fetch(`${BACKEND_URL}/api/api-keys/${scopedKeyId}/revoke`, {
    method: "POST",
    headers: { "Cookie": sessionCookie }
  });
  assert(revokeRes.ok, `Revoke endpoint returned status ${revokeRes.status}`);
  const revokeData = await revokeRes.json();
  assert(revokeData.success === true, "Revoke success is true");

  console.log("\n[15] Calling Gateway with Revoked Key (Expect 401 Unauthorized)...");
  const revokedCallRes = await fetch(`${BACKEND_URL}/api/gateway/open-meteo/forecast?latitude=40.71&longitude=-74.00`, {
    headers: { "X-API-Key": scopedRawKey }
  });
  assert(revokedCallRes.status === 401, `Revoked key correctly rejected with 401 (got ${revokedCallRes.status})`);
  const revokedData = await revokedCallRes.json();
  assert(revokedData.success === false, "Revoked call success is false");
  console.log(`    Revoked response: ${revokedData.message}`);

  // 8b. Public User Reviews & Ratings Verification
  console.log("\n[16] Testing Public Production Reviews (/api/reviews)...");
  const prodReviewsGetRes = await fetch(`${BACKEND_URL}/api/reviews`);
  assert(prodReviewsGetRes.ok, `GET /api/reviews returned status ${prodReviewsGetRes.status}`);
  const prodReviewsGetData = await prodReviewsGetRes.json();
  assert(prodReviewsGetData.success === true, "Reviews GET success is true");
  assert(prodReviewsGetData.summary !== undefined, "Summary metrics object present");
  assert(Array.isArray(prodReviewsGetData.reviews), "Reviews list is an array");
  console.log(`    Live Production Reviews in DB: ${prodReviewsGetData.summary.totalReviews}`);

  console.log("\n[17] Testing Unauthenticated Review Submission (Expect 401 Unauthorized)...");
  const prodUnauthReviewRes = await fetch(`${BACKEND_URL}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating: 5, review: "Unauthenticated review attempt", feature: "API Gateway" })
  });
  assert(prodUnauthReviewRes.status === 401, `Unauthenticated review rejected with 401 (got ${prodUnauthReviewRes.status})`);

  console.log("\n[18] Submitting Authenticated Production Review...");
  const prodReviewText = "APIHub's gateway proxy delivers sub-100ms response times with clean token isolation. Exceptional developer tooling.";
  const prodAuthReviewRes = await fetch(`${BACKEND_URL}/api/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": sessionCookie
    },
    body: JSON.stringify({ rating: 5, review: prodReviewText, feature: "API Gateway" })
  });
  assert(prodAuthReviewRes.status === 201, `Review submission returned status 201 (got ${prodAuthReviewRes.status})`);
  const prodAuthReviewData = await prodAuthReviewRes.json();
  assert(prodAuthReviewData.success === true, "Review submission success is true");
  assert(prodAuthReviewData.review !== undefined, "Review payload returned");
  const liveReviewId = prodAuthReviewData.review.id;
  assert(prodAuthReviewData.review.name === testName, `Reviewer name matches profile ('${testName}')`);
  assert(prodAuthReviewData.review.email === undefined, "Review response contains ZERO user emails");
  assert(!JSON.stringify(prodAuthReviewData).includes(testEmail), "Response JSON has zero email leakage");
  console.log(`    Live Review Created: ID=${liveReviewId}, Author=${prodAuthReviewData.review.name}, Rating=5★`);

  console.log("\n[19] Verifying Review in Public Production Feed (/api/reviews)...");
  const prodUpdatedGetRes = await fetch(`${BACKEND_URL}/api/reviews?page=1&limit=10`);
  const prodUpdatedGetData = await prodUpdatedGetRes.json();
  const foundProdReview = prodUpdatedGetData.reviews.find(r => r.id === liveReviewId);
  assert(foundProdReview !== undefined, "Submitted review appears in live public feed");
  assert(foundProdReview.name === testName, "Public review shows developer name");
  assert(foundProdReview.email === undefined, "Public review hides email address");
  assert(!JSON.stringify(prodUpdatedGetData).includes(testEmail), "Zero email addresses in public reviews endpoint");

  // 9. Clean up production test account and review
  console.log("\n[20] Cleaning up test user, keys, and review from Supabase...");
  const { database } = await import("../src/db.js");
  const db = database();
  if (liveReviewId) {
    await db.query("DELETE FROM public.reviews WHERE id = $1", [liveReviewId]);
  }
  await db.query("DELETE FROM public.api_keys WHERE user_id = $1", [signupData.user.id]);
  await db.query("DELETE FROM public.users WHERE id = $1", [signupData.user.id]);
  console.log("    Production test data cleaned up successfully.");
  await db.end();

  console.log("\n===================================================================");
  console.log(`🎉 ALL LIVE PRODUCTION SMOKE TESTS PASSED! (${testPassed} passed, ${testFailed} failed)`);
  console.log("===================================================================");
  process.exit(0);
}

runProductionSmokeTests().catch(err => {
  console.error("\n❌ Production Smoke Test Error:", err);
  process.exit(1);
});
