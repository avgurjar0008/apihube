import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireApiKey } from "../middleware/auth.js";
import { resolveApi, forwardGatewayRequest } from "../gateway/gateway.service.js";

const router = Router();

// Require a valid, active APIHub API key for all gateway endpoints
router.use(requireApiKey);

// Per-key rate limiting foundation (configurable, default 60 req/min)
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.GATEWAY_RATE_LIMIT || 60),
    keyGenerator: req => req.apiKey?.id || "anonymous",
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "APIHub Gateway rate limit exceeded. Please wait a minute before making further requests."
    }
  })
);

// GET /api/gateway/docs/:apiSlug - Documentation and metadata endpoint
router.get("/docs/:apiSlug", async (req, res) => {
  try {
    const meta = await resolveApi(req.params.apiSlug, req.apiKey.user_id);
    res.json({
      success: true,
      data: {
        apiSlug: meta.slug,
        name: meta.name,
        type: meta.type,
        gatewayBaseUrl: `/api/gateway/${meta.slug}`,
        authentication: {
          clientAuth: "X-API-Key: <your_apihub_key> or Authorization: Bearer <your_apihub_key>",
          upstreamAuth: "Managed server-side by APIHub Gateway (provider credentials remain secure)"
        },
        endpoints: (meta.endpoints || []).map(e => ({
          name: e.name,
          method: e.method,
          gatewayPath: `/api/gateway/${meta.slug}${e.path}`,
          parameters: e.parameters,
          exampleRequest: `curl -H "X-API-Key: YOUR_APIHUB_API_KEY" "${req.protocol}://${req.get("host")}/api/gateway/${meta.slug}${e.path}"`,
          exampleResponse: e.example
        }))
      }
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// Main Gateway Request Handler (handles all HTTP methods)
async function handleGatewayProxy(req, res) {
  const apiSlug = req.params.apiSlug;
  const subPath = req.params[0] ? `/${req.params[0]}` : "";
  const searchIndex = req.url.indexOf("?");
  const search = searchIndex !== -1 ? req.url.slice(searchIndex) : "";

  try {
    const result = await forwardGatewayRequest({
      apiSlug,
      subPath,
      search,
      method: req.method,
      headers: req.headers,
      body: req.body,
      apiKey: req.apiKey,
      userId: req.apiKey.user_id
    });

    // Apply safe response headers from upstream
    for (const [headerKey, headerVal] of Object.entries(result.headers)) {
      res.setHeader(headerKey, headerVal);
    }

    if (typeof result.body === "object") {
      res.status(result.status).json(result.body);
    } else {
      res.status(result.status).send(result.body);
    }
  } catch (err) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      success: false,
      status: statusCode,
      message: err.message,
      ...(err.code ? { code: err.code } : {})
    });
  }
}

// Support both root path (/api/gateway/:apiSlug) and nested paths (/api/gateway/:apiSlug/*)
router.all("/:apiSlug", handleGatewayProxy);
router.all("/:apiSlug/*", handleGatewayProxy);

export default router;
