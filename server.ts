import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Setup body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for external requests (e.g. from GitHub Pages)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// File-based local storage helper functions
const CONTACTS_FILE = path.join(process.cwd(), "local_contacts.json");

function saveToLocalFile(filePath: string, data: any) {
  try {
    let list: any[] = [];
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      try {
        list = JSON.parse(fileContent);
        if (!Array.isArray(list)) list = [];
      } catch (e) {
        list = [];
      }
    }
    const newEntry = {
      ...data,
      id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
      createdAt: new Date().toISOString()
    };
    list.push(newEntry);
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
    return newEntry;
  } catch (error) {
    console.error(`❌ Error saving to file ${filePath}:`, error);
    throw error;
  }
}

// API POST endpoint to save contact form submissions
app.post("/api/contact", (req, res) => {
  try {
    const { name, email, message, joinWaitlist } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required." });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email is required." });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const cleanedData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message && message.trim() ? message.trim() : "",
      joinWaitlist: joinWaitlist === true || joinWaitlist === "true"
    };

    const savedEntry = saveToLocalFile(CONTACTS_FILE, cleanedData);
    console.log(`📝 Contact message (Waitlist: ${cleanedData.joinWaitlist}) saved successfully to local file! (ID: ${savedEntry.id})`);
    
    return res.status(201).json({ 
      success: true, 
      message: "Your submission has been successfully saved!", 
      databaseSaved: true,
      id: savedEntry.id
    });
  } catch (err: any) {
    console.error("❌ Error processing contact form:", err);
    return res.status(500).json({
      error: "Unable to process message: " + (err.message || "Unknown error")
    });
  }
});

// Start Express + Vite Server inside an async wrapper to avoid top-level await inside CJS bundling
async function startServer() {
  // Vite middleware for rendering and SPA routing
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind server to port 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Capybara Full-Stack Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("❌ Failed to start the server:", err);
});
