import crypto from "crypto";
import { database } from "../db.js";
import { apiCatalog } from "../../../frontend/src/apiCatalog.js";
import { getProviderConfig } from "./providers.config.js";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const PRIVATE_HOST_REGEX = /(^localhost$|^127\.|^0\.0\.0\.0$|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\.|^169\.254\.|^::1$|^fc|^fd)/i;

// Headers that clients must not forward to upstream
const BLOCKED_CLIENT_HEADERS = new Set([
  "authorization",
  "x-api-key",
  "cookie",
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-length"
]);

/**
 * Identify and verify API access for the calling user/key.
 * Returns API metadata or throws an error with HTTP status code.
 */
export async function resolveApi(apiSlug, userId) {
  if (!apiSlug || typeof apiSlug !== "string") {
    const err = new Error("API identifier is required.");
    err.status = 400;
    throw err;
  }

  const cleanSlug = apiSlug.trim().toLowerCase();

  // 1. Check curated catalog APIs (public to all authenticated APIHub key holders)
  const catalogMatch = apiCatalog.find(
    a => a.id.toLowerCase() === cleanSlug || a.name.toLowerCase() === cleanSlug
  );
  if (catalogMatch) {
    return {
      type: "catalog",
      slug: catalogMatch.id,
      name: catalogMatch.name,
      baseUrl: catalogMatch.baseUrl,
      description: catalogMatch.description,
      authentication: catalogMatch.authentication,
      endpoints: catalogMatch.endpoints || []
    };
  }

  // 2. Check private user APIs in database
  const db = database();
  if (db) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanSlug);
    const query = isUuid
      ? "SELECT id, user_id, name, description, base_url, type FROM user_apis WHERE id=$1"
      : "SELECT id, user_id, name, description, base_url, type FROM user_apis WHERE LOWER(name)=$1";

    const result = await db.query(query, [cleanSlug]);

    if (result.rowCount > 0) {
      const row = result.rows[0];

      // MULTI-TENANT ISOLATION CHECK:
      // Verify that this private API belongs to the user who owns this API key
      if (row.user_id !== userId) {
        const err = new Error("Forbidden: This private API does not belong to the API key owner.");
        err.status = 403;
        throw err;
      }

      return {
        type: "user_api",
        slug: row.id,
        name: row.name,
        baseUrl: row.base_url,
        description: row.description,
        authentication: "APIHub User API",
        userId: row.user_id
      };
    }
  }

  const notFoundErr = new Error(`API '${apiSlug}' not found.`);
  notFoundErr.status = 404;
  throw notFoundErr;
}

/**
 * Filter client request headers: strip auth and internal transport headers
 */
function sanitizeClientHeaders(headers = {}) {
  const safe = {};
  for (const [k, v] of Object.entries(headers)) {
    const lower = k.toLowerCase();
    if (!BLOCKED_CLIENT_HEADERS.has(lower) && v !== undefined && v !== null) {
      safe[k] = String(v);
    }
  }
  safe["User-Agent"] = safe["User-Agent"] || safe["user-agent"] || "APIHub-Gateway/1.0";
  return safe;
}

/**
 * Safely join baseUrl and subPath avoiding duplicate slashes
 */
function buildTargetUrl(baseUrl, subPath, search = "") {
  const cleanBase = (baseUrl || "").trim().replace(/\/+$/, "");
  const cleanPath = (subPath || "").trim().replace(/^\/+/, "");
  const full = cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
  const urlObj = new URL(full);
  if (search) {
    const searchParams = new URLSearchParams(search);
    for (const [k, v] of searchParams.entries()) {
      urlObj.searchParams.set(k, v);
    }
  }
  return urlObj;
}

/**
 * Validate that the target URL does not target local/private IP ranges (SSRF protection)
 */
function validateUrlSafety(urlObj) {
  if (!["http:", "https:"].includes(urlObj.protocol)) {
    const err = new Error("Only HTTP and HTTPS protocols are supported.");
    err.status = 400;
    throw err;
  }
  if (PRIVATE_HOST_REGEX.test(urlObj.hostname)) {
    const err = new Error("Requests to private, local, and loopback network addresses are forbidden.");
    err.status = 403;
    throw err;
  }
}

/**
 * Asynchronously record usage into gateway_usage table
 */
export async function recordGatewayUsage({ apiKeyId, userId, apiSlug, method, endpointPath, statusCode, responseTimeMs }) {
  const db = database();
  if (!db || !apiKeyId || !userId) return;

  try {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO gateway_usage 
       (id, api_key_id, user_id, api_identifier, method, endpoint_path, status_code, response_time_ms) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, apiKeyId, userId, apiSlug, method, endpointPath, statusCode, responseTimeMs]
    );
  } catch (err) {
    // Non-blocking log, do not fail gateway forward if logging table write fails
    console.error("[APIHub Gateway] Failed to write usage record:", err.message);
  }
}

/**
 * Main Gateway Forwarding Execution
 */
export async function forwardGatewayRequest({
  apiSlug,
  subPath = "",
  search = "",
  method = "GET",
  headers = {},
  body,
  apiKey,
  userId
}) {
  const upperMethod = String(method || "GET").toUpperCase();
  if (!ALLOWED_METHODS.has(upperMethod)) {
    const err = new Error(`Unsupported HTTP method '${upperMethod}'. Allowed: ${Array.from(ALLOWED_METHODS).join(", ")}`);
    err.status = 405;
    throw err;
  }

  // 1. Resolve API & verify tenant authorization
  const apiMeta = await resolveApi(apiSlug, userId);

  // 2. Build target URL
  const targetUrl = buildTargetUrl(apiMeta.baseUrl, subPath, search);
  validateUrlSafety(targetUrl);

  // 3. Filter client headers
  const outgoingHeaders = sanitizeClientHeaders(headers);
  const fetchOptions = {
    method: upperMethod,
    headers: outgoingHeaders
  };

  // 4. Server-Side Provider Secret Configuration & Injection
  const providerConfig = getProviderConfig(apiMeta.slug);
  let injectedSecret = null;

  if (providerConfig) {
    const secretValue = process.env[providerConfig.envVar];
    if (!secretValue) {
      const err = new Error(
        `Upstream provider credentials for '${apiMeta.name || apiMeta.slug}' are not configured. ` +
        `Server administrator must configure environment variable '${providerConfig.envVar}'.`
      );
      err.status = 503;
      err.code = "PROVIDER_NOT_CONFIGURED";
      throw err;
    }
    injectedSecret = secretValue;
    // Inject server-side secret (header or query parameter)
    providerConfig.inject(fetchOptions, targetUrl, secretValue);
  }

  // 5. Handle Request Body
  if (!["GET", "HEAD"].includes(upperMethod) && body !== undefined && body !== null && body !== "") {
    if (typeof body === "object") {
      fetchOptions.body = JSON.stringify(body);
      if (!fetchOptions.headers["Content-Type"] && !fetchOptions.headers["content-type"]) {
        fetchOptions.headers["Content-Type"] = "application/json";
      }
    } else {
      fetchOptions.body = String(body);
    }
  }

  // 6. Forward Request to Upstream
  const started = performance.now();
  let upstreamResponse;
  try {
    upstreamResponse = await fetch(targetUrl.toString(), {
      ...fetchOptions,
      signal: AbortSignal.timeout(15000)
    });
  } catch (fetchErr) {
    const isTimeout = fetchErr.name === "TimeoutError";
    const err = new Error(isTimeout ? "Upstream provider request timed out after 15 seconds." : `Failed to reach upstream provider: ${fetchErr.message}`);
    err.status = isTimeout ? 504 : 502;
    throw err;
  }

  const responseTimeMs = Math.round(performance.now() - started);
  const responseText = await upstreamResponse.text();

  // 7. Leak Prevention & Sanitization: Ensure provider secret is NEVER in response
  let safeResponseText = responseText;
  if (injectedSecret && injectedSecret.length > 4 && safeResponseText.includes(injectedSecret)) {
    safeResponseText = safeResponseText.replaceAll(injectedSecret, "[REDACTED]");
  }

  let parsedBody = safeResponseText;
  try {
    parsedBody = JSON.parse(safeResponseText);
  } catch {
    // Keep as text if not JSON
  }

  // 8. Filter Upstream Response Headers
  const safeResponseHeaders = {};
  for (const [k, v] of upstreamResponse.headers.entries()) {
    const lower = k.toLowerCase();
    if (!["set-cookie", "server", "transfer-encoding", "connection"].includes(lower)) {
      safeResponseHeaders[k] = v;
    }
  }
  safeResponseHeaders["x-apihub-gateway"] = "v1";
  safeResponseHeaders["x-response-time-ms"] = String(responseTimeMs);

  // 9. Record Usage Asynchronously
  recordGatewayUsage({
    apiKeyId: apiKey?.id,
    userId,
    apiSlug: apiMeta.slug,
    method: upperMethod,
    endpointPath: targetUrl.pathname,
    statusCode: upstreamResponse.status,
    responseTimeMs
  });

  return {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: safeResponseHeaders,
    body: parsedBody,
    responseTimeMs,
    api: {
      slug: apiMeta.slug,
      name: apiMeta.name,
      type: apiMeta.type
    }
  };
}
