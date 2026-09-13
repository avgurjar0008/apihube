import { Router } from "express";
import crypto from "crypto";
import { database } from "../db.js";
import { requireUser } from "../middleware/auth.js";

const router = Router();

const clean = r => ({
  id: r.id,
  name: r.name,
  apiSlug: r.api_slug || "all",
  apiName: r.api_name || "All APIs (Full Access)",
  category: r.category || "All Categories",
  prefix: r.key_prefix,
  createdAt: r.created_at,
  revokedAt: r.revoked_at,
  lastUsedAt: r.last_used_at,
  status: r.revoked_at ? "Revoked" : "Active",
  usage: Number(r.usage_count || 0)
});

router.use(requireUser);

// GET /api/api-keys - List user keys with usage analytics
router.get("/", async (req, res) => {
  try {
    const result = await database().query(`
      SELECT 
        k.id, 
        k.name, 
        k.key_prefix, 
        k.api_slug, 
        k.api_name, 
        k.category, 
        k.created_at, 
        k.revoked_at, 
        k.last_used_at,
        COALESCE(u.usage_count, 0) as usage_count
      FROM api_keys k
      LEFT JOIN (
        SELECT api_key_id, COUNT(*)::int as usage_count
        FROM gateway_usage
        GROUP BY api_key_id
      ) u ON u.api_key_id = k.id
      WHERE k.user_id = $1
      ORDER BY k.created_at DESC
    `, [req.user.sub]);

    res.json({ success: true, data: result.rows.map(clean) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to load API keys: " + err.message });
  }
});

// POST /api/api-keys - Generate a new APIHub API key (supports specific API scoping or all APIs)
router.post("/", async (req, res) => {
  try {
    const rawName = String(req.body?.name || "").trim().slice(0, 80);
    const apiSlug = String(req.body?.apiSlug || req.body?.api_slug || "all").trim().toLowerCase().slice(0, 80);
    const apiName = String(req.body?.apiName || req.body?.api_name || (apiSlug === "all" ? "All APIs (Full Access)" : apiSlug)).trim().slice(0, 100);
    const category = String(req.body?.category || (apiSlug === "all" ? "All Categories" : "General")).trim().slice(0, 60);

    const name = rawName || (apiSlug === "all" ? "Default API Key" : `${apiName} Key`);

    const raw = `ah_live_${crypto.randomBytes(32).toString("base64url")}`;
    const id = crypto.randomUUID();
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    const prefix = raw.slice(0, 16);

    const result = await database().query(
      `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, api_slug, api_name, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, req.user.sub, name, hash, prefix, apiSlug, apiName, category]
    );

    res.status(201).json({
      success: true,
      data: clean({ ...result.rows[0], usage_count: 0 }),
      secret: raw,
      message: "Copy this API key now. For your security, it will not be displayed again."
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to generate API key: " + err.message });
  }
});

// POST /api/api-keys/:id/revoke - Revoke an API key
router.post("/:id/revoke", async (req, res) => {
  try {
    const result = await database().query(
      `UPDATE api_keys 
       SET revoked_at = now() 
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL 
       RETURNING id`,
      [req.params.id, req.user.sub]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: "Active API key not found or already revoked." });
    }

    res.json({ success: true, message: "API key revoked successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to revoke key: " + err.message });
  }
});

export default router;
