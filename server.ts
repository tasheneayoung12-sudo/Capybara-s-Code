import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { createServer as createViteServer } from "vite";
import { SayHello } from "./src/db/SayHello";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

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

// MongoDB Connection Logic
const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI || "";

function cleanMongoUri(uri: string): string {
  if (!uri) return "";
  // Strip any literal '<' and '>' angle brackets around the password if present
  return uri.replace(/:<([^>]+)>/, ":$1");
}

const mongoUri = cleanMongoUri(rawUri);
let connectionPromise: Promise<any> | null = null;

async function connectMongoDB() {
  if (!mongoUri) {
    console.warn("⚠️ WARNING: MONGODB_URI environment variable is not defined! Submissions cannot be saved to MongoDB Atlas.");
    return null;
  }
  
  if ((mongoose.connection.readyState as number) === 1) return mongoose.connection;
  
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const maskedUri = mongoUri.replace(/:[^@]+@/, ":****@");
      console.log(`🔌 Attempting to connect to MongoDB Atlas at: ${maskedUri}`);
      
      // Dynamically extract the dbName from the URI if specified, otherwise fall back to "Gothies_Info"
      let dbName = "Gothies_Info";
      try {
        const parsedUrl = new URL(mongoUri);
        const parsedDb = parsedUrl.pathname.replace(/^\//, "").split("?")[0];
        if (parsedDb) {
          dbName = parsedDb;
        }
      } catch (err) {
        // Fallback if URL parsing fails
      }

      console.log(`🔌 Selected Database Name: "${dbName}"`);
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000, // 5 second timeout
        dbName: dbName
      });
      console.log(`🔌 Connected to MongoDB Atlas successfully! Database: "${mongoose.connection.name}"`);
      return mongoose.connection;
    } catch (error) {
      console.error("❌ Error connecting to MongoDB Atlas:", error);
      connectionPromise = null; // Reset on failure to allow retry
      throw error;
    }
  })();

  return connectionPromise;
}

// Fire initial connection try
connectMongoDB().catch(err => console.error("Initial connect try failed:", err));

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
app.post("/api/contact", async (req, res) => {
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

    // Connect to MongoDB if offline
    if ((mongoose.connection.readyState as number) !== 1) {
      try {
        await connectMongoDB();
      } catch (err) {
        console.warn("⚠️ Could not connect to MongoDB Atlas during request, falling back to local file storage:", err);
      }
    }

    if ((mongoose.connection.readyState as number) === 1) {
      try {
        const contactDoc = new SayHello(cleanedData);
        await contactDoc.save();
        console.log(`📝 Contact message (Waitlist: ${cleanedData.joinWaitlist}) saved successfully to MongoDB! (ID: ${contactDoc._id})`);
        
        return res.status(201).json({ 
          success: true, 
          message: "Your submission has been successfully saved to MongoDB Atlas!", 
          databaseSaved: true,
          id: contactDoc._id
        });
      } catch (dbErr: any) {
        console.warn("⚠️ Failed to write to MongoDB Atlas (possible authorization/permission issue). Falling back to local file storage. Error:", dbErr.message);
        const savedEntry = saveToLocalFile(CONTACTS_FILE, cleanedData);
        
        return res.status(201).json({
          success: true,
          message: "Your submission was saved locally. (MongoDB Atlas write permission issue: " + dbErr.message + ")",
          databaseSaved: false,
          id: savedEntry.id
        });
      }
    } else {
      const savedEntry = saveToLocalFile(CONTACTS_FILE, cleanedData);
      console.log(`⚠️ Database offline fallback: Saved contact message locally! (ID: ${savedEntry.id})`);
      
      return res.status(201).json({ 
        success: true, 
        message: "Your submission has been successfully saved locally!", 
        databaseSaved: false,
        id: savedEntry.id
      });
    }
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
