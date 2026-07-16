import mongoose from "mongoose";

/**
 * Clean MongoDB connection URI by removing accidental < > brackets around credentials.
 */
function cleanMongoUri(uri) {
  if (!uri) return "";
  let cleaned = uri.trim();
  
  // Remove literal '<' and '>' characters around username/password if they exist (e.g. mongodb+srv://<user>:<pwd>@...)
  const atIndex = cleaned.indexOf('@');
  if (atIndex !== -1) {
    const creds = cleaned.substring(0, atIndex);
    const rest = cleaned.substring(atIndex);
    const cleanedCreds = creds.replace(/[<>]/g, "");
    cleaned = cleanedCreds + rest;
  }
  
  return cleaned;
}

/**
 * Establishes a secure connection to MongoDB Atlas.
 */
export const connectDB = async () => {
  const rawUrl = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.MONGODB_URl;

  if (!rawUrl) {
    console.error("❌ Error: No MongoDB connection string was found. Please define MONGODB_URI in your environment variables.");
    return;
  }

  const mongoUrl = cleanMongoUri(rawUrl);

  try {
    const conn = await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      dbName: "Gothies_Info" // Explicitly target Gothies_Info
    });

    const maskedUrl = mongoUrl.replace(/:[^@]+@/, ":****@");
    console.log(`🔌 MongoDB connected: ${conn.connection.host}`);
    console.log(`🔌 Database Name: "${conn.connection.name}"`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    console.log("⚠️ Continuing server startup anyway. Database connection will be retried automatically by Mongoose.");
  }
};

