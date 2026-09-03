import { Router } from "express";
import { executeRequest } from "../services/request.service.js";

const router = Router();

router.post("/execute", async (req, res) => {
  try {
    const data = await executeRequest(req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/history", (req, res) => res.json({
  success: true,
  data: [],
  message: "Persistent request history will be connected in Phase 2."
}));

export default router;
