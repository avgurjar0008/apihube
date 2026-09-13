import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health.routes.js";
import requestRouter from "./routes/request.routes.js";
import authRouter from "./routes/auth.routes.js";
import keysRouter from "./routes/keys.routes.js";
import userApisRouter from "./routes/user-apis.routes.js";
import userEndpointsRouter from "./routes/user-endpoints.routes.js";
import libraryRouter from "./routes/library.routes.js";
import gatewayRouter from "./routes/gateway.routes.js";
import savedRequestsRouter from "./routes/saved-requests.routes.js";
import aiRouter from "./routes/ai.routes.js";
import { requireDatabase } from "./db.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);

const allowedOrigins = [
  "https://apihube.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5173",
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"]
}));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api/health", healthRouter);
app.use("/api/requests", requestRouter);
app.use("/api/ai", aiRouter);
app.use("/api/auth", requireDatabase, authRouter);
app.use("/api/api-keys", requireDatabase, keysRouter);
app.use("/api/my-apis", requireDatabase, userApisRouter);
app.use("/api/my-apis", requireDatabase, userEndpointsRouter);
app.use("/api/saved-requests", requireDatabase, savedRequestsRouter);
app.use("/api/gateway", requireDatabase, gatewayRouter);
app.use("/api/v1", requireDatabase, libraryRouter);

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));

app.listen(PORT, () => console.log(`APIHub backend running on http://localhost:${PORT}`));
