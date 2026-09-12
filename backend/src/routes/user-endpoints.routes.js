import { Router } from "express";
import crypto from "crypto";
import { database } from "../db.js";
import { requireUser } from "../middleware/auth.js";

const router = Router();

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const cleanEndpoint = row => ({
  id: row.id,
  apiId: row.api_id,
  method: row.method,
  path: row.path,
  name: row.name,
  description: row.description || "",
  parameters: row.parameters || "",
  requestBody: row.request_body || "",
  responseExample: row.response_example || "",
  createdAt: row.created_at
});

router.use(requireUser);

async function verifyApiOwnership(apiId, userId) {
  const result = await database().query(
    "SELECT id FROM user_apis WHERE id=$1 AND user_id=$2",
    [apiId, userId]
  );
  return result.rowCount > 0;
}

// GET /api/my-apis/:apiId/endpoints - List all endpoints for a user-owned API
router.get("/:apiId/endpoints", async (req, res) => {
  try {
    const isOwner = await verifyApiOwnership(req.params.apiId, req.user.sub);
    if (!isOwner) {
      return res.status(404).json({ success: false, message: "Parent API not found or unauthorized." });
    }

    const result = await database().query(
      "SELECT id, api_id, method, path, name, description, parameters, request_body, response_example, created_at FROM user_endpoints WHERE api_id=$1 ORDER BY created_at ASC",
      [req.params.apiId]
    );

    res.json({ success: true, data: result.rows.map(cleanEndpoint) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to retrieve endpoints: " + error.message });
  }
});

// POST /api/my-apis/:apiId/endpoints - Create an endpoint under a user-owned API
router.post("/:apiId/endpoints", async (req, res) => {
  try {
    const isOwner = await verifyApiOwnership(req.params.apiId, req.user.sub);
    if (!isOwner) {
      return res.status(404).json({ success: false, message: "Parent API not found or unauthorized." });
    }

    const name = String(req.body?.name || "").trim().slice(0, 150);
    const path = String(req.body?.path || "").trim().slice(0, 500);
    const method = String(req.body?.method || "GET").trim().toUpperCase();
    const description = String(req.body?.description || "").trim().slice(0, 1000);
    const parameters = String(req.body?.parameters || "").trim().slice(0, 2000);
    const requestBody = String(req.body?.requestBody ?? req.body?.request_body ?? "").trim().slice(0, 50000);
    const responseExample = String(req.body?.responseExample ?? req.body?.response_example ?? "").trim().slice(0, 50000);

    if (!name || !path) {
      return res.status(400).json({ success: false, message: "Endpoint Name and Path are required." });
    }

    if (!ALLOWED_METHODS.includes(method)) {
      return res.status(400).json({ success: false, message: `Unsupported method. Allowed: ${ALLOWED_METHODS.join(", ")}` });
    }

    // Check duplicate endpoint (same method & path for this API)
    const existing = await database().query(
      "SELECT id FROM user_endpoints WHERE api_id=$1 AND method=$2 AND path=$3",
      [req.params.apiId, method, path]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({ success: false, message: "An endpoint with this HTTP method and path already exists for this API." });
    }

    const id = (typeof req.body?.id === "string" && req.body.id.length === 36)
      ? req.body.id
      : crypto.randomUUID();

    const result = await database().query(
      "INSERT INTO user_endpoints (id, api_id, method, path, name, description, parameters, request_body, response_example) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
      [id, req.params.apiId, method, path, name, description, parameters, requestBody, responseExample]
    );

    res.status(201).json({ success: true, data: cleanEndpoint(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to create endpoint: " + error.message });
  }
});

// DELETE /api/my-apis/:apiId/endpoints/:id - Delete an endpoint
router.delete("/:apiId/endpoints/:id", async (req, res) => {
  try {
    const isOwner = await verifyApiOwnership(req.params.apiId, req.user.sub);
    if (!isOwner) {
      return res.status(404).json({ success: false, message: "Parent API not found or unauthorized." });
    }

    const result = await database().query(
      "DELETE FROM user_endpoints WHERE id=$1 AND api_id=$2 RETURNING id",
      [req.params.id, req.params.apiId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: "Endpoint not found." });
    }

    res.json({ success: true, message: "Endpoint deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to delete endpoint: " + error.message });
  }
});

export default router;
