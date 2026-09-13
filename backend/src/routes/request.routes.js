import { Router } from "express";
import crypto from "crypto";
import { executeRequest } from "../services/request.service.js";
import { database } from "../db.js";
import { optionalUser, requireUser } from "../middleware/auth.js";

const router = Router();

router.post("/execute", optionalUser, async (req, res) => {
  try {
    const data = await executeRequest(req.body);

    // If user is authenticated and DB is configured, record execution in request_history
    if (req.user?.sub && database()) {
      const id = crypto.randomUUID();
      database().query(
        `INSERT INTO request_history (id, user_id, method, url, status, response_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, req.user.sub, data.method, data.url, data.status, data.responseTimeMs]
      ).catch(err => console.error("[Request History Log Error]:", err.message));
    }

    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/requests/history - Retrieve user's request history
router.get("/history", optionalUser, async (req, res) => {
  if (!req.user?.sub || !database()) {
    return res.json({ success: true, data: [] });
  }

  try {
    const result = await database().query(
      `SELECT id, method, url, status, response_time_ms as "time", created_at as "createdAt"
       FROM request_history
       WHERE user_id=$1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.sub]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to load request history: " + error.message });
  }
});

// DELETE /api/requests/history - Clear user's request history
router.delete("/history", requireUser, async (req, res) => {
  if (!database()) return res.json({ success: true });
  try {
    await database().query("DELETE FROM request_history WHERE user_id=$1", [req.user.sub]);
    res.json({ success: true, message: "Request history cleared." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to clear history: " + error.message });
  }
});

export default router;
