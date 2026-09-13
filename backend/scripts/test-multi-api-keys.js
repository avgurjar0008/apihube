import "dotenv/config";
import crypto from "crypto";
import { database } from "../src/db.js";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";

async function runMultiApiKeyTest() {
  console.log("===================================================================");
  console.log("    APIHub Multi-API Key Platform & Category Access Test Suite     ");
  console.log("===================================================================");

  const pool = database();
  if (!pool) {
    console.error("❌ Database pool could not be initialized.");
    process.exit(1);
  }

  const timestamp = Date.now();
  const testEmail = `multikey_${timestamp}@example.com`;
  const testPassword = `Pass#${timestamp}!`;
  let sessionCookie = "";
  let userId = null;

  try {
    // 1. Sign Up test user
    console.log(`\n[1] Creating developer user: ${testEmail}...`);
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
    const cookie = signupRes.headers.get("set-cookie");
    if (cookie) sessionCookie = cookie.split(";")[0];
    console.log(`✅ User registered. ID: ${userId}`);

    // 2. Generate Scoped API Key (Scoped to 'open-meteo')
    console.log("\n[2] Generating Scoped API Key for 'Open-Meteo' (Weather & Climate)...");
    const scopedKeyRes = await fetch(`${BASE_URL}/api/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie
      },
      body: JSON.stringify({
        name: "Weather App Scoped Key",
        apiSlug: "open-meteo",
        apiName: "Open-Meteo",
        category: "Weather & Climate"
      })
    });
    const scopedKeyData = await scopedKeyRes.json();
    if (!scopedKeyRes.ok || !scopedKeyData.success) {
      throw new Error(`Scoped key generation failed: ${JSON.stringify(scopedKeyData)}`);
    }
    const scopedRawKey = scopedKeyData.secret;
    const scopedKeyId = scopedKeyData.data.id;
    console.log(`✅ Scoped API Key generated: ${scopedRawKey.slice(0, 16)}••••`);
    console.log(`   Scope: ${scopedKeyData.data.apiName} (${scopedKeyData.data.category})`);

    // Verify DB integrity for scoped key
    const scopedDbCheck = await pool.query("SELECT * FROM api_keys WHERE id=$1", [scopedKeyId]);
    const scopedRow = scopedDbCheck.rows[0];
    if (scopedRow.api_slug !== "open-meteo" || scopedRow.category !== "Weather & Climate") {
      throw new Error(`Database scope fields mismatch: slug=${scopedRow.api_slug}, category=${scopedRow.category}`);
    }
    if (scopedRow.key_hash === scopedRawKey) {
      throw new Error("SECURITY FAILURE: Raw API key stored in database!");
    }
    console.log("✅ DB integrity verified: Scoped columns correct, raw key NOT stored in DB.");

    // 3. Test Authorized Gateway access using scoped key (Open-Meteo)
    console.log("\n[3] Testing Gateway call to Open-Meteo with Open-Meteo scoped key...");
    const weatherRes = await fetch(`${BASE_URL}/api/gateway/open-meteo/forecast?latitude=40.71&longitude=-74.00`, {
      headers: { "X-API-Key": scopedRawKey }
    });
    console.log(`   Status: ${weatherRes.status} ${weatherRes.statusText}`);
    const weatherBody = await weatherRes.json();
    if (weatherRes.status !== 200 || typeof weatherBody.latitude !== "number") {
      throw new Error(`Expected 200 OK from Open-Meteo, got ${weatherRes.status}: ${JSON.stringify(weatherBody)}`);
    }
    console.log(`✅ Open-Meteo returned real forecast data (Lat: ${weatherBody.latitude}, Lon: ${weatherBody.longitude})`);

    // 4. Test Gateway Scope Enforcement: Try accessing Binance (Crypto) with Open-Meteo key
    console.log("\n[4] Testing Scope Restriction: Calling Binance (Crypto) with Open-Meteo scoped key...");
    const cryptoBlockedRes = await fetch(`${BASE_URL}/api/gateway/binance/ticker/price?symbol=BTCUSDT`, {
      headers: { "X-API-Key": scopedRawKey }
    });
    console.log(`   Status: ${cryptoBlockedRes.status} ${cryptoBlockedRes.statusText}`);
    const cryptoBlockedBody = await cryptoBlockedRes.json();
    if (cryptoBlockedRes.status !== 403 || cryptoBlockedBody.code !== "API_KEY_SCOPE_MISMATCH") {
      throw new Error(`Expected 403 API_KEY_SCOPE_MISMATCH, got ${cryptoBlockedRes.status}: ${JSON.stringify(cryptoBlockedBody)}`);
    }
    console.log(`✅ Gateway correctly denied cross-API access with 403 Forbidden!`);
    console.log(`   Message: "${cryptoBlockedBody.message}"`);

    // 5. Generate Global API Key ('all')
    console.log("\n[5] Generating Global API Key ('all' - Full Access across all 18 categories)...");
    const globalKeyRes = await fetch(`${BASE_URL}/api/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie
      },
      body: JSON.stringify({
        name: "Full Access Global Key",
        apiSlug: "all",
        apiName: "All APIs (Full Access)",
        category: "All Categories"
      })
    });
    const globalKeyData = await globalKeyRes.json();
    if (!globalKeyRes.ok || !globalKeyData.success) {
      throw new Error(`Global key generation failed: ${JSON.stringify(globalKeyData)}`);
    }
    const globalRawKey = globalKeyData.secret;
    const globalKeyId = globalKeyData.data.id;
    console.log(`✅ Global API Key generated: ${globalRawKey.slice(0, 16)}••••`);

    // 6. Test Multi-Category Access with Global Key
    console.log("\n[6] Testing Gateway Multi-Category Access with Global Key:");

    // 6a. Weather category
    console.log("   -> Category: Weather & Climate (Open-Meteo)...");
    const gWeather = await fetch(`${BASE_URL}/api/gateway/open-meteo/forecast?latitude=51.50&longitude=-0.12`, {
      headers: { "X-API-Key": globalRawKey }
    });
    if (gWeather.status !== 200) throw new Error(`Global key weather failed: ${gWeather.status}`);
    console.log("      ✓ Weather: 200 OK");

    // 6b. Crypto & Blockchain category
    console.log("   -> Category: Crypto & Blockchain (Binance)...");
    const gCrypto = await fetch(`${BASE_URL}/api/gateway/binance/ticker/price?symbol=BTCUSDT`, {
      headers: { "X-API-Key": globalRawKey }
    });
    if (gCrypto.status !== 200) throw new Error(`Global key crypto failed: ${gCrypto.status}`);
    const btcData = await gCrypto.json();
    console.log(`      ✓ Crypto: 200 OK (BTC Price: $${btcData.price})`);

    // 6c. Currency & Exchange Rates category
    console.log("   -> Category: Currency & Exchange Rates (Frankfurter FX)...");
    const gFx = await fetch(`${BASE_URL}/api/gateway/frankfurter/latest?from=USD&to=EUR`, {
      headers: { "X-API-Key": globalRawKey }
    });
    if (gFx.status !== 200) throw new Error(`Global key FX failed: ${gFx.status}`);
    const fxData = await gFx.json();
    console.log(`      ✓ Currency: 200 OK (USD/EUR: ${fxData.rates?.EUR})`);

    // 6d. Movies & Entertainment category
    console.log("   -> Category: Movies & Entertainment (TVmaze)...");
    const gTv = await fetch(`${BASE_URL}/api/gateway/tvmaze/shows/1`, {
      headers: { "X-API-Key": globalRawKey }
    });
    if (gTv.status !== 200) throw new Error(`Global key TVmaze failed: ${gTv.status}`);
    const tvData = await gTv.json();
    console.log(`      ✓ Entertainment: 200 OK (Show: ${tvData.name})`);

    // 6e. Countries & World Data category
    console.log("   -> Category: Countries & World Data (World Bank)...");
    const gCountries = await fetch(`${BASE_URL}/api/gateway/world-bank/country/IND?format=json`, {
      headers: { "X-API-Key": globalRawKey }
    });
    if (gCountries.status !== 200) throw new Error(`Global key Countries failed: ${gCountries.status}`);
    console.log("      ✓ Countries: 200 OK");

    // 6f. Random & Fun APIs category
    console.log("   -> Category: Random/Fun APIs (JokeAPI)...");
    const gJoke = await fetch(`${BASE_URL}/api/gateway/jokeapi/joke/Programming?safe-mode`, {
      headers: { "X-API-Key": globalRawKey }
    });
    if (gJoke.status !== 200) throw new Error(`Global key JokeAPI failed: ${gJoke.status}`);
    console.log("      ✓ Random/Fun: 200 OK");

    // 7. Verify API Key List & Usage Analytics
    console.log("\n[7] Verifying Key List & Real Usage Analytics from GET /api/api-keys...");
    const listRes = await fetch(`${BASE_URL}/api/api-keys`, {
      headers: { Cookie: sessionCookie }
    });
    const listData = await listRes.json();
    if (!listRes.ok || !listData.success) {
      throw new Error(`Listing keys failed: ${JSON.stringify(listData)}`);
    }

    console.log(`   Total keys returned: ${listData.data.length}`);
    for (const k of listData.data) {
      console.log(`   - [${k.category}] ${k.apiName} (${k.name}): ${k.prefix}•••• | Usage: ${k.usage} requests | Status: ${k.status}`);
    }

    const scopedFromList = listData.data.find(k => k.id === scopedKeyId);
    const globalFromList = listData.data.find(k => k.id === globalKeyId);
    if (!scopedFromList || !globalFromList) {
      throw new Error("Created keys not found in list!");
    }
    if (scopedFromList.usage < 1) {
      throw new Error(`Expected scoped key usage >= 1, got ${scopedFromList.usage}`);
    }
    if (globalFromList.usage < 6) {
      throw new Error(`Expected global key usage >= 6, got ${globalFromList.usage}`);
    }
    console.log("✅ Usage analytics accurately aggregated from gateway_usage!");

    // 8. Test Revocation
    console.log("\n[8] Testing Revocation of Scoped Key...");
    const revokeRes = await fetch(`${BASE_URL}/api/api-keys/${scopedKeyId}/revoke`, {
      method: "POST",
      headers: { Cookie: sessionCookie }
    });
    const revokeData = await revokeRes.json();
    if (!revokeRes.ok || !revokeData.success) {
      throw new Error(`Revocation failed: ${JSON.stringify(revokeData)}`);
    }
    console.log("   Revoke response:", revokeData.message);

    // Call gateway with revoked key -> Must return 401
    const revokedGatewayRes = await fetch(`${BASE_URL}/api/gateway/open-meteo/forecast?latitude=40.71&longitude=-74.00`, {
      headers: { "X-API-Key": scopedRawKey }
    });
    if (revokedGatewayRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for revoked key, got ${revokedGatewayRes.status}`);
    }
    console.log("✅ Revoked key immediately rejected with 401 Unauthorized by gateway!");

    // 9. Cleanup
    console.log("\n[9] Cleaning up test records from database...");
    await pool.query("DELETE FROM gateway_usage WHERE user_id=$1", [userId]);
    await pool.query("DELETE FROM api_keys WHERE user_id=$1", [userId]);
    await pool.query("DELETE FROM users WHERE id=$1", [userId]);
    console.log("✅ Test data cleaned up successfully.");

    console.log("\n===================================================================");
    console.log("   🎉 ALL MULTI-API KEY & GATEWAY ACCESS TESTS PASSED!           ");
    console.log("===================================================================\n");
  } catch (err) {
    console.error("\n❌ Test Failed:", err);
    if (userId) {
      await pool.query("DELETE FROM gateway_usage WHERE user_id=$1", [userId]).catch(() => {});
      await pool.query("DELETE FROM api_keys WHERE user_id=$1", [userId]).catch(() => {});
      await pool.query("DELETE FROM users WHERE id=$1", [userId]).catch(() => {});
    }
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

runMultiApiKeyTest();

