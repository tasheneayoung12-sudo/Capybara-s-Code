import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { WebsiteSurvey } from "./src/db/WebsiteSurvey";
import { SayHello } from "./src/db/SayHello";

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

// MongoDB Connection Logic
const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb+srv://gothtechies26_db_user:<Gothtechies2026>@gothtechiescluster.bfsxlti.mongodb.net/?appName=GothTechiesCluster";

function cleanMongoUri(uri: string): string {
  if (!uri) return "";
  // Strip any literal '<' and '>' angle brackets around the password if present
  return uri.replace(/:<([^>]+)>/, ":$1");
}

const mongoUri = cleanMongoUri(rawUri);
let connectionPromise: Promise<any> | null = null;

async function connectMongoDB() {
  if (!mongoUri) {
    console.warn("⚠️ WARNING: MONGODB_URI environment variable is not defined! Survey submissions cannot be saved to MongoDB Atlas.");
    return null;
  }
  
  if ((mongoose.connection.readyState as number) === 1) return mongoose.connection;
  
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      console.log("🔌 Attempting to connect to MongoDB Atlas...");
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000, // 5 second timeout
        dbName: "Gothies_Info" // Force database to 'Gothies_Info'
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

// API GET endpoint to retrieve survey submissions from MongoDB Atlas
app.get("/api/website-survey", async (req, res) => {
  try {
    // Check/reconnect
    if ((mongoose.connection.readyState as number) !== 1) {
      await connectMongoDB();
      if ((mongoose.connection.readyState as number) !== 1) {
        return res.status(503).json({
          error: "Survey service is temporarily offline: Unable to connect to your MongoDB Atlas cluster.",
          databaseMode: "offline",
          data: []
        });
      }
    }

    // Fetch from MongoDB
    const mongoSubmissions = await WebsiteSurvey.find().sort({ createdAt: -1 }).limit(100);
    
    // Map to standard form
    const submissions = mongoSubmissions.map(doc => ({
      id: doc._id,
      firstName: doc.firstName,
      lastName: doc.lastName,
      email: doc.email,
      phoneNumber: doc.phoneNumber,
      newsletterConsent: doc.newsletterConsent,
      createdAt: doc.createdAt
    }));

    return res.json({
      success: true,
      databaseMode: "online",
      data: submissions
    });
  } catch (err: any) {
    console.error("❌ Server Error during fetching surveys:", err);
    return res.status(500).json({
      error: err.message || "An internal error occurred while fetching survey responses."
    });
  }
});

// API POST endpoint to save survey submissions to MongoDB Atlas
app.post("/api/website-survey", async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, newsletterConsent } = req.body;

    // 1. Validation check
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ error: "First Name is required." });
    }
    if (!lastName || !lastName.trim()) {
      return res.status(400).json({ error: "Last Name is required." });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email Address is required." });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const cleanedData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phoneNumber: phoneNumber && phoneNumber.trim() ? phoneNumber.trim() : undefined,
      newsletterConsent: newsletterConsent === true || newsletterConsent === "true",
      formName: "Website Survey"
    };

    // 2. Connect if offline
    if ((mongoose.connection.readyState as number) !== 1) {
      await connectMongoDB();
      if ((mongoose.connection.readyState as number) !== 1) {
        return res.status(503).json({
          error: "Survey service is temporarily offline: Unable to connect to your MongoDB Atlas cluster. Please check your network whitelist settings or credentials.",
          databaseMode: "offline"
        });
      }
    }

    // 3. Save to MongoDB Atlas
    const newSurvey = new WebsiteSurvey(cleanedData);
    await newSurvey.save();
    console.log(`📝 Survey saved successfully to websiteSurvey Atlas! (ID: ${newSurvey._id})`);

    return res.status(201).json({
      success: true,
      message: "Awesome! Your survey responses have been successfully submitted to your live MongoDB Atlas cluster.",
      databaseMode: "online",
      data: {
        id: newSurvey._id,
        firstName: newSurvey.firstName,
        lastName: newSurvey.lastName,
        email: newSurvey.email,
        createdAt: newSurvey.createdAt
      }
    });

  } catch (err: any) {
    console.error("❌ Server Error during survey submission:", err);
    return res.status(400).json({
      error: err.message || "An internal error occurred while trying to save your survey response."
    });
  }
});

// API POST endpoint to proxy contact form submissions securely and save to MongoDB Atlas
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    
    if (!name || !name.trim() || !email || !email.trim() || !message || !message.trim()) {
      return res.status(400).json({ error: "Name, email, and message are required." });
    }

    // 1. Connect to MongoDB if offline and save the contact message
    if ((mongoose.connection.readyState as number) !== 1) {
      await connectMongoDB();
    }

    let savedToMongo = false;
    let mongoId = null;

    if ((mongoose.connection.readyState as number) === 1) {
      try {
        const contactDoc = new SayHello({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          message: message.trim()
        });
        await contactDoc.save();
        console.log(`📝 Contact message saved successfully to MongoDB! (ID: ${contactDoc._id})`);
        savedToMongo = true;
        mongoId = contactDoc._id;
      } catch (dbErr: any) {
        console.error("❌ Error saving contact message to MongoDB Atlas:", dbErr);
      }
    } else {
      console.warn("⚠️ Unable to save to MongoDB Atlas: database is currently offline.");
    }

    const referer = req.get("referer") || "http://localhost:3000";
    const origin = req.get("origin") || "http://localhost:3000";

    // Respond immediately to the frontend once saved to MongoDB Atlas
    if (savedToMongo) {
      res.status(200).json({ 
        success: true, 
        message: "Message received and stored in database successfully!", 
        databaseSaved: true,
        mongoId
      });

      // Fire-and-forget relay to FormSubmit in the background so it doesn't block or cause frontend timeouts
      console.log(`📩 Relaying contact form submission for ${email} to FormSubmit in the background...`);
      fetch("https://formsubmit.co/ajax/tashenea.young12@gmail.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Referer": referer,
          "Origin": origin
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          message: message.trim(),
          _subject: "New Contact Message - Capybara Testing"
        })
      })
      .then(async (response) => {
        const text = await response.text();
        if (response.ok) {
          console.log("✅ Background FormSubmit relay succeeded:", text);
        } else {
          console.warn(`⚠️ Background FormSubmit returned status ${response.status}:`, text);
        }
      })
      .catch((err) => {
        console.error("❌ Background FormSubmit relay failed:", err.message || err);
      });

      return;
    }

    // Fallback if MongoDB is offline: attempt a synchronous block for FormSubmit so the message is not lost
    console.log(`📩 MongoDB offline, attempting direct relay to FormSubmit...`);
    const response = await fetch("https://formsubmit.co/ajax/tashenea.young12@gmail.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Referer": referer,
        "Origin": origin
      },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        message: message.trim(),
        _subject: "New Contact Message - Capybara Testing"
      })
    });

    const text = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      data = { rawResponse: text };
    }

    if (!response.ok) {
      throw new Error(data.message || `FormSubmit returned status ${response.status}`);
    }

    console.log("✅ Contact form relayed directly to FormSubmit successfully!");
    return res.json({ 
      success: true, 
      message: "Message sent successfully via email notification service!", 
      databaseSaved: false,
      data 
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
