import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { SayHello } from "./models/SayHello.js";
import contactRoutes from "./routes/contactRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB Atlas Database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// Proxy & Security Middlewares
// ==========================================

// Enable 'trust proxy' so express-rate-limit can accurately read the client's actual IP
// when running behind Render's, AWS's, or Heroku's load balancers.
app.set("trust proxy", 1);

// 1. Helmet: Sets secure HTTP headers to prevent common exploits (Clickjacking, XSS, etc.)
app.use(helmet());

// 2. CORS: Restrict or allow Cross-Origin requests
// In production, configure this to ONLY accept requests from your frontend URL (e.g., GitHub Pages)
const corsOptions = {
  origin: process.env.NODE_ENV === "production" 
    ? [/\.github\.io$/, "https://tasheneayoung.github.io", /run\.app$/, /\.gothtechies\.net$/, "https://www.gothtechies.net", "https://gothtechies.net"] // Allow GitHub Pages, AI Studio, and Custom GoDaddy Domains
    : "*", // Allow all origins in development
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
app.use(cors(corsOptions));

// 3. Body Parsers: Parse incoming payload types
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// API Routing Entries
// ==========================================

// Health Check Endpoint (useful for checking server status on Render/Heroku)
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Database Connection Diagnostics Endpoint
app.get("/api/test-db", async (req, res) => {
  try {
    const readyState = mongoose.connection.readyState;
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    const statusString = states[readyState] || "unknown";
    
    let pingSuccess = false;
    let messageCount = 0;
    
    if (readyState === 1) {
      try {
        await mongoose.connection.db.admin().ping();
        pingSuccess = true;
        messageCount = await SayHello.countDocuments().catch(() => 0);
      } catch (pingErr) {
        console.error("Database ping/query failed on backend:", pingErr);
      }
    }
    
    res.status(200).json({
      success: true,
      configured: !!(process.env.MONGODB_URI || process.env.MONGODB_URL),
      connectionStatus: statusString,
      readyState: readyState,
      ping: pingSuccess ? "success" : "failed",
      databaseName: mongoose.connection.name || "none",
      messageCount: messageCount,
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || "Unknown error during diagnostics"
    });
  }
});

// Contact Route Handler
app.use("/api/contact", contactRoutes);

// Gemini AI Route Handler
app.use("/api/ai", aiRoutes);

// ==========================================
// Global Error Handler
// ==========================================
app.use((err, req, res, next) => {
  console.error("❌ Global Error Triggered:", err.stack);
  res.status(500).json({
    error: "An unexpected error occurred on the server.",
  });
});

// ==========================================
// Server Bootstrap
// ==========================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Production Server running in "${process.env.NODE_ENV || "development"}" mode`);
  console.log(`🚀 Listening on http://localhost:${PORT}`);
});
