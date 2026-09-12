import { Router } from "express";
import crypto from "crypto";
import { database } from "../db.js";
import { requireUser } from "../middleware/auth.js";

const router = Router();

const cleanApi = row => ({
  id: row.id,
  name: row.name,
  description: row.description || "",
  baseUrl: row.base_url,
  type: row.type || "REST",
  createdAt: row.created_at
});

router.use(requireUser);

// GET /api/my-apis - List all APIs belonging to the authenticated user
router.get("/", async (req, res) => {
  try {
    const result = await database().query(
      "SELECT id, user_id, name, description, base_url, type, created_at FROM user_apis WHERE user_id=$1 ORDER BY created_at DESC",
      [req.user.sub]
    );
    res.json({ success: true, data: result.rows.map(cleanApi) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to retrieve APIs: " + error.message });
  }
});

// POST /api/my-apis - Create a new API for the authenticated user
router.post("/", async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 100);
  const baseUrl = String(req.body?.baseUrl || req.body?.base_url || "").trim().slice(0, 500);
  const description = String(req.body?.description || "").trim().slice(0, 1000);
  const type = req.body?.type === "Testing" ? "Testing" : "REST";

  if (!name || !baseUrl) {
    return res.status(400).json({ success: false, message: "API Name and Base URL are required." });
  }

  try {
    // Avoid duplicate records with exact same name and baseUrl for this user
    const existing = await database().query(
      "SELECT id, user_id, name, description, base_url, type, created_at FROM user_apis WHERE user_id=$1 AND LOWER(name)=$2 AND base_url=$3",
      [req.user.sub, name.toLowerCase(), baseUrl]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({
        success: false,
        message: "An API with this name and base URL already exists.",
        data: cleanApi(existing.rows[0])
      });
    }

    const id = (typeof req.body?.id === "string" && req.body.id.length === 36)
      ? req.body.id
      : crypto.randomUUID();

    const result = await database().query(
      "INSERT INTO user_apis (id, user_id, name, description, base_url, type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [id, req.user.sub, name, description, baseUrl, type]
    );

    res.status(201).json({ success: true, data: cleanApi(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to create API: " + error.message });
  }
});

// DELETE /api/my-apis/:id - Delete an API owned by the authenticated user
router.delete("/:id", async (req, res) => {
  try {
    const result = await database().query(
      "DELETE FROM user_apis WHERE id=$1 AND user_id=$2 RETURNING id",
      [req.params.id, req.user.sub]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: "API not found or unauthorized." });
    }

    res.json({ success: true, message: "API deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to delete API: " + error.message });
  }
});

export default router;
