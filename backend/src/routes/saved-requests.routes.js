import { Router } from "express";
import crypto from "crypto";
import { database } from "../db.js";
import { requireUser } from "../middleware/auth.js";

const router = Router();
router.use(requireUser);

const cleanSaved = (row) => ({
  id: row.id,
  userId: row.user_id,
  method: row.method,
  url: row.url,
  headers: row.headers || "",
  body: row.body || "",
  params: row.params || [],
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// GET /api/saved-requests - List user's saved requests
router.get("/", async (req, res) => {
  try {
    const result = await database().query(
      "SELECT * FROM saved_requests WHERE user_id=$1 ORDER BY created_at DESC",
      [req.user.sub]
    );
    res.json({ success: true, data: result.rows.map(cleanSaved) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to retrieve saved requests: " + err.message });
  }
});

// POST /api/saved-requests - Save a new request
router.post("/", async (req, res) => {
  try {
    const method = String(req.body?.method || "GET").toUpperCase();
    const url = String(req.body?.url || "").trim();
    const headers = typeof req.body?.headers === "string" ? req.body.headers : JSON.stringify(req.body?.headers || "");
    const body = typeof req.body?.body === "string" ? req.body.body : JSON.stringify(req.body?.body || "");
    const params = Array.isArray(req.body?.params) ? JSON.stringify(req.body.params) : "[]";
    const id = (typeof req.body?.id === "string" && req.body.id.length === 36) ? req.body.id : crypto.randomUUID();

    if (!url) {
      return res.status(400).json({ success: false, message: "Request URL is required to save request." });
    }

    const result = await database().query(
      `INSERT INTO saved_requests (id, user_id, method, url, headers, body, params)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, req.user.sub, method, url, headers, body, params]
    );

    res.status(201).json({ success: true, data: cleanSaved(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to save request: " + err.message });
  }
});

// DELETE /api/saved-requests/:id - Delete a saved request
router.delete("/:id", async (req, res) => {
  try {
    const result = await database().query(
      "DELETE FROM saved_requests WHERE id=$1 AND user_id=$2 RETURNING id",
      [req.params.id, req.user.sub]
    );
    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: "Saved request not found." });
    }
    res.json({ success: true, message: "Saved request deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to delete saved request: " + err.message });
  }
});

// DELETE /api/saved-requests - Clear all saved requests for user
router.delete("/", async (req, res) => {
  try {
    await database().query("DELETE FROM saved_requests WHERE user_id=$1", [req.user.sub]);
    res.json({ success: true, message: "All saved requests cleared." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to clear saved requests: " + err.message });
  }
});

export default router;

