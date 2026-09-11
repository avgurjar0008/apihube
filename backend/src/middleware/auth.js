import jwt from "jsonwebtoken";
import crypto from "crypto";
import { database } from "../db.js";

const secret = () => process.env.JWT_SECRET;
export function sessionCookie(res, token) { res.cookie("apihub_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.COOKIE_SAME_SITE || "lax", maxAge: 7 * 24 * 60 * 60 * 1000, path: "/" }); }
export function requireUser(req, res, next) {
  if (!secret()) return res.status(503).json({ success: false, message: "Authentication is not configured." });
  const token = req.cookies?.apihub_session || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  try { req.user = jwt.verify(token, secret()); next(); } catch { res.status(401).json({ success: false, message: "Authentication required." }); }
}
export async function requireApiKey(req, res, next) {
  const raw = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!raw || !raw.startsWith("ah_")) return res.status(401).json({ success: false, message: "A valid APIHub API key is required." });
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const result = await database().query("SELECT id, user_id FROM api_keys WHERE key_hash=$1 AND revoked_at IS NULL", [hash]);
  if (!result.rowCount) return res.status(401).json({ success: false, message: "Invalid or revoked API key." });
  req.apiKey = result.rows[0]; database().query("UPDATE api_keys SET last_used_at=now() WHERE id=$1", [req.apiKey.id]).catch(() => {}); next();
}
