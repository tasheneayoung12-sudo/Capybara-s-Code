import { GoogleGenAI } from "@google/genai";

let aiClient = null;

/**
 * Initializes and returns the Google GenAI client instance.
 * Re-uses the instance if it already exists.
 */
export const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("⚠️ Warning: GEMINI_API_KEY is not defined in your environment variables. AI features will be disabled.");
    return null;
  }

  if (!aiClient) {
    try {
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      console.log("🤖 Gemini AI Client successfully initialized!");
    } catch (error) {
      console.error(`❌ Failed to initialize Gemini AI Client: ${error.message}`);
    }
  }

  return aiClient;
};
