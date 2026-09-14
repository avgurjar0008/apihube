import { Router } from "express";
import { database } from "../db.js";
import { requireUser } from "../middleware/auth.js";

const router = Router();

// Allowed standard features for reviews
const ALLOWED_FEATURES = [
  "Overall APIHub",
  "API Gateway",
  "API Tester",
  "API Documentation",
  "Learn",
  "AI Assistant",
  "API Marketplace",
  "API Key Management"
];

function sanitizeText(str = "") {
  return String(str)
    .replace(/<[^>]*>?/gm, "") // Strip HTML tags
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // Strip non-printable ASCII
    .trim();
}

/**
 * GET /api/reviews
 * Public endpoint to fetch developer reviews with aggregated summary metrics.
 */
router.get("/", async (req, res) => {
  const db = database();
  if (!db) {
    return res.status(503).json({ success: false, message: "Database is unavailable." });
  }

  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const offset = (page - 1) * limit;
    const sort = String(req.query.sort || "newest").toLowerCase();

    // 1. Fetch aggregated rating metrics across all approved reviews
    const summaryResult = await db.query(`
      SELECT 
        rating, 
        COUNT(*)::int as count 
      FROM public.reviews 
      WHERE status = 'approved' 
      GROUP BY rating;
    `);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalReviews = 0;
    let weightedRatingSum = 0;

    for (const row of summaryResult.rows) {
      const r = Number(row.rating);
      const c = Number(row.count);
      if (distribution[r] !== undefined) {
        distribution[r] = c;
        totalReviews += c;
        weightedRatingSum += r * c;
      }
    }

    const averageRating = totalReviews > 0
      ? Number((weightedRatingSum / totalReviews).toFixed(1))
      : 0;

    const percentages = {
      1: totalReviews > 0 ? Math.round((distribution[1] / totalReviews) * 100) : 0,
      2: totalReviews > 0 ? Math.round((distribution[2] / totalReviews) * 100) : 0,
      3: totalReviews > 0 ? Math.round((distribution[3] / totalReviews) * 100) : 0,
      4: totalReviews > 0 ? Math.round((distribution[4] / totalReviews) * 100) : 0,
      5: totalReviews > 0 ? Math.round((distribution[5] / totalReviews) * 100) : 0
    };

    // 2. Determine sort order
    let orderByClause = "created_at DESC";
    if (sort === "highest") {
      orderByClause = "rating DESC, created_at DESC";
    } else if (sort === "lowest") {
      orderByClause = "rating ASC, created_at DESC";
    }

    // 3. Fetch paginated reviews (safe public fields only)
    const reviewsResult = await db.query(`
      SELECT 
        id,
        name,
        rating,
        review,
        feature,
        created_at
      FROM public.reviews
      WHERE status = 'approved'
      ORDER BY ${orderByClause}
      LIMIT $1 OFFSET $2;
    `, [limit, offset]);

    const totalPages = Math.ceil(totalReviews / limit) || 1;
    const hasMore = page < totalPages;

    return res.json({
      success: true,
      summary: {
        averageRating,
        totalReviews,
        distribution,
        percentages
      },
      reviews: reviewsResult.rows,
      pagination: {
        page,
        limit,
        totalReviews,
        totalPages,
        hasMore
      }
    });
  } catch (err) {
    console.error("[Reviews GET Error]:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch reviews." });
  }
});

/**
 * POST /api/reviews
 * Authenticated endpoint to submit a developer review.
 */
router.post("/", requireUser, async (req, res) => {
  const db = database();
  if (!db) {
    return res.status(503).json({ success: false, message: "Database is unavailable." });
  }

  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  let { rating, review, feature } = req.body || {};

  // Validate rating
  const numRating = Number(rating);
  if (!rating || isNaN(numRating) || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({
      success: false,
      message: "Rating must be an integer between 1 and 5."
    });
  }

  // Validate review text
  const cleanReview = sanitizeText(review);
  if (!cleanReview || cleanReview.length < 10) {
    return res.status(400).json({
      success: false,
      message: "Review must be at least 10 characters."
    });
  }
  if (cleanReview.length > 1000) {
    return res.status(400).json({
      success: false,
      message: "Review cannot exceed 1000 characters."
    });
  }

  // Validate & sanitize feature
  let cleanFeature = sanitizeText(feature) || "Overall APIHub";
  if (!ALLOWED_FEATURES.includes(cleanFeature)) {
    if (cleanFeature.length > 50) {
      cleanFeature = cleanFeature.substring(0, 50);
    }
  }

  try {
    // 1. Resolve reviewer display name safely from authenticated user profile
    const userRes = await db.query(
      "SELECT name, email FROM public.users WHERE id = $1 LIMIT 1;",
      [userId]
    );

    if (!userRes.rowCount) {
      return res.status(401).json({ success: false, message: "User session is invalid." });
    }

    const userData = userRes.rows[0];
    let displayName = (userData.name || "").trim();
    if (!displayName) {
      // Safe fallback from email prefix without exposing full email address
      const emailPrefix = (userData.email || "").split("@")[0].trim();
      displayName = emailPrefix ? `${emailPrefix.charAt(0).toUpperCase()}${emailPrefix.slice(1)}` : "Developer";
    }
    // Final sanitization of display name
    displayName = sanitizeText(displayName).substring(0, 80);

    // 2. Cooldown check: prevent duplicate rapid spam (1 submission per 60 seconds)
    const cooldownRes = await db.query(`
      SELECT created_at 
      FROM public.reviews 
      WHERE user_id = $1 AND created_at > now() - interval '60 seconds'
      LIMIT 1;
    `, [userId]);

    if (cooldownRes.rowCount > 0) {
      return res.status(429).json({
        success: false,
        message: "Please wait a moment before submitting another review."
      });
    }

    // 3. Insert review into Supabase
    const insertRes = await db.query(`
      INSERT INTO public.reviews (
        user_id,
        name,
        rating,
        review,
        feature,
        status
      ) VALUES ($1, $2, $3, $4, $5, 'approved')
      RETURNING id, name, rating, review, feature, created_at;
    `, [userId, displayName, numRating, cleanReview, cleanFeature]);

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully.",
      review: insertRes.rows[0]
    });
  } catch (err) {
    console.error("[Reviews POST Error]:", err.message);
    return res.status(500).json({
      success: false,
      message: "Unable to submit your review. Please try again."
    });
  }
});

export default router;
