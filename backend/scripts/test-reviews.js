/**
 * APIHub Reviews & Ratings Automated Test Suite
 * Validates the complete review lifecycle:
 * 1. Public GET reviews with aggregated summary metrics
 * 2. Unauthenticated POST rejection (401)
 * 3. Rating validation rejection (400)
 * 4. Short review text validation rejection (400)
 * 5. Authenticated review submission (201)
 * 6. Supabase database row verification
 * 7. Correct reviewer display name resolution (never exposing private email)
 * 8. Dynamic rating average & distribution calculation
 * 9. XSS sanitization check
 * 10. Clean-up of test data
 */

import "dotenv/config";
import { database } from "../src/db.js";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";

async function runReviewsTests() {
  console.log("===================================================================");
  console.log("           APIHub PUBLIC USER REVIEWS & RATINGS TEST SUITE         ");
  console.log("===================================================================");
  console.log(`Backend Target URL: ${BASE_URL}`);
  console.log("-------------------------------------------------------------------\n");

  const pool = database();
  if (!pool) {
    console.error("❌ Database pool could not be initialized.");
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  const timestamp = Date.now();
  const testEmail = `reviewer_${timestamp}@example.com`;
  const testPassword = `ReviewPass#${timestamp}!`;
  const testName = "Senior Systems Engineer";
  let sessionCookie = "";
  let bearerToken = "";
  let userId = null;
  let createdReviewId = null;

  try {
    // 1. Public GET /api/reviews Check
    console.log("[1] Testing Public GET /api/reviews...");
    const publicGetRes = await fetch(`${BASE_URL}/api/reviews`);
    assert(publicGetRes.ok, `GET /api/reviews returned status ${publicGetRes.status}`);
    const publicGetData = await publicGetRes.json();
    assert(publicGetData.success === true, "Response has success: true");
    assert(publicGetData.summary !== undefined, "Response includes summary metrics");
    assert(typeof publicGetData.summary.averageRating === "number", "summary.averageRating is a number");
    assert(typeof publicGetData.summary.totalReviews === "number", "summary.totalReviews is a number");
    assert(publicGetData.summary.distribution !== undefined, "summary.distribution exists");
    assert(Array.isArray(publicGetData.reviews), "reviews is an array");
    assert(publicGetData.pagination !== undefined, "pagination metadata exists");
    console.log(`    Current approved reviews in DB: ${publicGetData.summary.totalReviews}`);
    console.log(`    Current average rating: ${publicGetData.summary.averageRating} ★`);

    // 2. Unauthenticated POST Rejection Check
    console.log("\n[2] Testing Unauthenticated POST /api/reviews (Should return 401)...");
    const unauthPostRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: 5,
        review: "This is a great platform for testing APIs.",
        feature: "Overall APIHub"
      })
    });
    assert(unauthPostRes.status === 401, `Unauthenticated POST rejected with 401 (got ${unauthPostRes.status})`);
    const unauthData = await unauthPostRes.json();
    assert(unauthData.success === false, "Unauthenticated response success is false");

    // 3. Register Authenticated Test User
    console.log("\n[3] Creating authenticated test user for review submission...");
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword, name: testName })
    });
    assert(signupRes.status === 201, `Sign Up returned 201 (got ${signupRes.status})`);
    const signupData = await signupRes.json();
    userId = signupData.user?.id;
    bearerToken = signupData.token || "";
    const rawCookie = signupRes.headers.get("set-cookie");
    if (rawCookie) sessionCookie = rawCookie.split(";")[0];
    console.log(`    User created: ${testEmail} (ID: ${userId})`);

    const authHeaders = {
      "Content-Type": "application/json",
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {})
    };

    // 4. Invalid Rating Validation Check
    console.log("\n[4] Testing Invalid Rating Validation (Should return 400)...");
    const badRatingRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        rating: 6, // Invalid > 5
        review: "Testing with an out-of-bounds rating number.",
        feature: "API Gateway"
      })
    });
    assert(badRatingRes.status === 400, `Rating > 5 rejected with 400 (got ${badRatingRes.status})`);

    const zeroRatingRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        rating: 0, // Invalid < 1
        review: "Testing with a zero star rating.",
        feature: "API Gateway"
      })
    });
    assert(zeroRatingRes.status === 400, `Rating 0 rejected with 400 (got ${zeroRatingRes.status})`);

    // 5. Short Review Text Validation Check
    console.log("\n[5] Testing Short Review Text (< 10 chars) (Should return 400)...");
    const shortReviewRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        rating: 5,
        review: "Too short", // 9 chars
        feature: "API Gateway"
      })
    });
    assert(shortReviewRes.status === 400, `Short review text rejected with 400 (got ${shortReviewRes.status})`);

    // 6. Valid Authenticated Review Submission with XSS attempt
    console.log("\n[6] Submitting Valid Review with XSS tags to verify sanitization...");
    const rawXssReview = "APIHub's gateway proxy is blazing fast! <script>alert('xss')</script> Perfect for microservices.";
    const validPostRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        rating: 5,
        review: rawXssReview,
        feature: "API Gateway"
      })
    });
    assert(validPostRes.status === 201, `Valid review submitted with 201 (got ${validPostRes.status})`);
    const validPostData = await validPostRes.json();
    assert(validPostData.success === true, "Submit review response success is true");
    assert(validPostData.review !== undefined, "Submit review response has review object");
    createdReviewId = validPostData.review.id;

    // 7. Verify Review Identity & Zero Email Leakage in POST response
    console.log("\n[7] Verifying Reviewer Identity & Zero Email Leakage in response...");
    assert(validPostData.review.name === testName, `Reviewer name matches authenticated user profile ('${testName}')`);
    assert(validPostData.review.email === undefined, "Review object DOES NOT contain email field");
    assert(!JSON.stringify(validPostData.review).includes(testEmail), "Response JSON does NOT contain user's email address");

    // 8. Verify XSS Sanitization in Stored Content
    console.log("\n[8] Verifying XSS sanitization in stored review content...");
    assert(!validPostData.review.review.includes("<script>"), "HTML script tags were stripped from review text");
    assert(validPostData.review.review.includes("blazing fast!"), "Legitimate text content was preserved");

    // 9. Verify Review Row in Supabase Database Directly
    console.log("\n[9] Querying Supabase PostgreSQL directly to verify record...");
    const dbRowRes = await pool.query("SELECT * FROM public.reviews WHERE id = $1;", [createdReviewId]);
    assert(dbRowRes.rowCount === 1, "Review row found in Supabase database");
    const dbRow = dbRowRes.rows[0];
    assert(dbRow.user_id === userId, "Review user_id matches registered user ID");
    assert(Number(dbRow.rating) === 5, "Database rating is 5");
    assert(dbRow.status === "approved", "Review status is 'approved'");
    assert(dbRow.feature === "API Gateway", "Review feature is 'API Gateway'");

    // 10. Verify Review Appears in Public GET /api/reviews
    console.log("\n[10] Verifying submitted review appears in Public GET /api/reviews...");
    const updatedGetRes = await fetch(`${BASE_URL}/api/reviews?page=1&limit=10`);
    const updatedGetData = await updatedGetRes.json();
    const foundInGet = updatedGetData.reviews.find(r => r.id === createdReviewId);
    assert(foundInGet !== undefined, "Newly submitted review appears in public reviews feed");
    assert(foundInGet.name === testName, "Public review displays user full name");
    assert(foundInGet.email === undefined, "Public review list DOES NOT contain reviewer email");
    assert(!JSON.stringify(updatedGetData).includes(testEmail), "No reviewer emails appear anywhere in public JSON response");
    assert(foundInGet.rating === 5, "Public review rating is 5");

    // 11. Verify Aggregated Metrics Calculation
    console.log("\n[11] Verifying Rating Distribution and Average Calculation...");
    assert(updatedGetData.summary.totalReviews >= 1, `Total reviews is at least 1 (${updatedGetData.summary.totalReviews})`);
    assert(updatedGetData.summary.averageRating >= 1 && updatedGetData.summary.averageRating <= 5, `Average rating is between 1 and 5 (${updatedGetData.summary.averageRating})`);
    assert(updatedGetData.summary.distribution["5"] >= 1, "Distribution contains count for 5-star reviews");

    // 12. Cleanup Test Data from Supabase
    console.log("\n[12] Cleaning up test data from Supabase database...");
    await pool.query("DELETE FROM public.reviews WHERE id = $1;", [createdReviewId]);
    await pool.query("DELETE FROM public.users WHERE id = $1;", [userId]);
    console.log("    Test review and test user cleaned up successfully.");

    console.log("\n===================================================================");
    console.log(`🎉 ALL REVIEWS TESTS PASSED! (${passed}/${passed + failed})`);
    console.log("===================================================================\n");
  } catch (err) {
    console.error(`\n❌ TEST FAILED: ${err.message}`);
    // Cleanup if possible
    if (createdReviewId) await pool.query("DELETE FROM public.reviews WHERE id = $1;", [createdReviewId]).catch(() => {});
    if (userId) await pool.query("DELETE FROM public.users WHERE id = $1;", [userId]).catch(() => {});
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runReviewsTests();
