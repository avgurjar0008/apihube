import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health.routes.js";
import requestRouter from "./routes/request.routes.js";
import authRouter from "./routes/auth.routes.js";
import keysRouter from "./routes/keys.routes.js";
import libraryRouter from "./routes/library.routes.js";
import { requireDatabase } from "./db.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);

const origins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "https://apihube.vercel.app",
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: origins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api/health", healthRouter);
app.use("/api/requests", requestRouter);
app.use("/api/auth", requireDatabase, authRouter);
app.use("/api/api-keys", requireDatabase, keysRouter);
app.use("/api/v1", requireDatabase, libraryRouter);

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));

app.listen(PORT, () => console.log(`APIHub backend running on http://localhost:${PORT}`));
