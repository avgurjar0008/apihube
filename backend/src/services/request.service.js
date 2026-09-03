const ALLOWED = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function normalizeHeaders(headers = {}) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return {};
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([key, value]) => key && value !== undefined && value !== null)
      .map(([key, value]) => [String(key), String(value)])
  );
}

function parseBody(body) {
  if (body === undefined || body === null || body === "") return undefined;
  if (typeof body !== "string") return body;
  try { return JSON.parse(body); } catch { return body; }
}

export async function executeRequest(payload = {}) {
  const method = String(payload.method || "GET").toUpperCase();
  const url = String(payload.url || "").trim();

  if (!ALLOWED.has(method)) throw new Error("Unsupported HTTP method.");
  if (!url) throw new Error("Request URL is required.");

  let parsed;
  try { parsed = new URL(url); }
  catch { throw new Error("Please provide a valid absolute URL."); }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  const headers = normalizeHeaders(payload.headers);
  const body = parseBody(payload.body);
  const options = { method, headers };

  if (!["GET", "HEAD"].includes(method) && body !== undefined) {
    if (typeof body === "object") {
      options.body = JSON.stringify(body);
      if (!headers["Content-Type"] && !headers["content-type"]) {
        options.headers["Content-Type"] = "application/json";
      }
    } else {
      options.body = String(body);
    }
  }

  const started = performance.now();
  let response;
  try {
    response = await fetch(parsed.toString(), {
      ...options,
      signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    throw new Error(error?.name === "TimeoutError"
      ? "The request timed out after 15 seconds."
      : `Unable to reach the target API: ${error.message}`);
  }

  const responseTimeMs = Math.round(performance.now() - started);
  const text = await response.text();
  let responseBody = text;
  try { responseBody = JSON.parse(text); } catch {}

  return {
    method,
    url: parsed.toString(),
    status: response.status,
    statusText: response.statusText,
    responseTimeMs,
    responseSizeBytes: Buffer.byteLength(text, "utf8"),
    headers: Object.fromEntries(response.headers.entries()),
    body: responseBody
  };
}
