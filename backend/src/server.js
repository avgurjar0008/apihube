import "dotenv/config";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/health.routes.js";
import requestRouter from "./routes/request.routes.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175"
  ]
}));app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/requests", requestRouter);

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));

app.listen(PORT, () => console.log(`APIHub backend running on http://localhost:${PORT}`));
