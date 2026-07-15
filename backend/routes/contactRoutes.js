import express from "express";
import { createContactSubmission, getContactSubmissions } from "../controllers/contactController.js";
import { contactSubmissionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Route to submit the contact form (Rate-limited to prevent spam)
router.post("/", contactSubmissionLimiter, createContactSubmission);

// Route to list submissions
router.get("/", getContactSubmissions);

export default router;
