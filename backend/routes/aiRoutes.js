import express from "express";
import { generateAIContent } from "../controllers/aiController.js";
import { apiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Route to generate content using Gemini (Rate-limited)
router.post("/generate", apiLimiter, generateAIContent);

export default router;
