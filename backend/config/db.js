import mongoose from "mongoose";

/**
 * Establishes a secure connection to MongoDB Atlas.
 */
export const connectDB = async () => {
  const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URl || process.env.MONGODB_URI;

  if (!mongoUrl) {
    console.error("❌ Error: No MongoDB connection string was found. Please define MONGODB_URL in your environment variables.");
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
    });

    const maskedUrl = mongoUrl.replace(/:[^@]+@/, ":****@");
    console.log(`🔌 MongoDB connected: ${conn.connection.host}`);
    console.log(`🔌 Database Name: "${conn.connection.name}"`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};
