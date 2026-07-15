import { SayHello } from "../models/SayHello.js";

/**
 * Helper function to escape basic HTML tags to prevent XSS.
 * Converts characters like < and > into safe character entities.
 */
const escapeHTML = (str) => {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
};

/**
 * Handles incoming contact form / waitlist submissions.
 * POST /api/contact
 */
export const createContactSubmission = async (req, res) => {
  try {
    const { name, email, message, joinWaitlist } = req.body;

    // 1. Validation & Presence Checks
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required." });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email is required." });
    }

    // 2. Length Validations (Prevents extremely large payload DOS attacks)
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message ? message.trim() : "";

    if (trimmedName.length > 100) {
      return res.status(400).json({ error: "Name must be 100 characters or less." });
    }
    if (trimmedEmail.length > 150) {
      return res.status(400).json({ error: "Email must be 150 characters or less." });
    }
    if (trimmedMessage.length > 3000) {
      return res.status(400).json({ error: "Message must be 3000 characters or less." });
    }

    // 3. Email Format Validation
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    // 4. Input Sanitization/Escaping (Prevents XSS injection at rest)
    const contactData = {
      name: escapeHTML(trimmedName),
      email: trimmedEmail.toLowerCase(), // Email is safe to lowercase, no HTML allowed anyway
      message: escapeHTML(trimmedMessage),
      joinWaitlist: joinWaitlist === true || joinWaitlist === "true",
    };

    // 5. Save to MongoDB Atlas
    const newSubmission = new SayHello(contactData);
    await newSubmission.save();

    console.log(`📝 [Contact Controller] Saved submission successfully (ID: ${newSubmission._id})`);

    return res.status(201).json({
      success: true,
      message: "Your submission has been successfully saved to MongoDB Atlas!",
      id: newSubmission._id,
    });
  } catch (error) {
    // SECURITY IMPROVEMENT: Log full tech details on server for debugging, but hide it from public API response!
    console.error("❌ Error saving contact submission:", error);
    return res.status(500).json({
      error: "An unexpected server error occurred while processing your message. Please try again later.",
    });
  }
};

/**
 * Retrieves all submissions (Protected / internal use).
 * GET /api/contact
 */
export const getContactSubmissions = async (req, res) => {
  try {
    const submissions = await SayHello.find({}).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions,
    });
  } catch (error) {
    // SECURITY IMPROVEMENT: Log details internally, keep public error abstract.
    console.error("❌ Error fetching contact submissions:", error);
    return res.status(500).json({
      error: "An unexpected error occurred while retrieving submissions. Please try again later.",
    });
  }
};
