import jwt from "jsonwebtoken";
import crypto from "crypto";
import { database } from "../db.js";

const secret = () => process.env.JWT_SECRET;

export function sessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  const sameSite = process.env.COOKIE_SAME_SITE || (isProd ? "none" : "lax");
  const secure = isProd ? true : (sameSite === "none");
  res.cookie("apihub_session", token, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  });
}
export function requireUser(req, res, next) {
  if (!secret()) return res.status(503).json({ success: false, message: "Authentication is not configured." });
  const token = req.cookies?.apihub_session || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  try { req.user = jwt.verify(token, secret()); next(); } catch { res.status(401).json({ success: false, message: "Authentication required." }); }
}
export function optionalUser(req, res, next) {
  if (!secret()) return next();
  const token = req.cookies?.apihub_session || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return next();
  try { req.user = jwt.verify(token, secret()); } catch { /* ignore optional token verification failure */ }
  next();
}
export async function requireApiKey(req, res, next) {
  const headerKey = req.headers["x-api-key"];
  const bearerKey = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const raw = String(headerKey || bearerKey || "").trim();
  if (!raw || !raw.startsWith("ah_")) return res.status(401).json({ success: false, message: "A valid APIHub API key is required." });
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const result = await database().query("SELECT id, user_id, api_slug, api_name, category FROM api_keys WHERE key_hash=$1 AND revoked_at IS NULL", [hash]);
  if (!result.rowCount) return res.status(401).json({ success: false, message: "Invalid or revoked API key." });
  req.apiKey = result.rows[0]; database().query("UPDATE api_keys SET last_used_at=now() WHERE id=$1", [req.apiKey.id]).catch(() => {}); next();
}
