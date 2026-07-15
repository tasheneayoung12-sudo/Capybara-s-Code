import { getGeminiClient } from "../config/gemini.js";

/**
 * Generates text response using Gemini API.
 * POST /api/ai/generate
 */
export const generateAIContent = async (req, res) => {
  try {
    const { prompt, modelName } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length > 5000) {
      return res.status(400).json({ error: "Prompt is too long. Limit prompt to 5000 characters." });
    }

    const ai = getGeminiClient();

    if (!ai) {
      return res.status(503).json({
        error: "Gemini AI services are currently unavailable or unconfigured.",
      });
    }

    // Default to the modern recommended model: gemini-3.5-flash
    const model = modelName || "gemini-3.5-flash";

    console.log(`🤖 [AI Controller] Querying model ${model} with prompt...`);

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt.trim(),
    });

    const text = response.text;

    return res.status(200).json({
      success: true,
      text: text,
    });
  } catch (error) {
    // SECURITY IMPROVEMENT: Log details on the server for debugging, return generic safe messages to the user.
    console.error("❌ Error generating Gemini content:", error);
    return res.status(500).json({
      error: "An unexpected error occurred while generating content. Please try again later.",
    });
  }
};
