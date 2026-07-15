import rateLimit from "express-rate-limit";

/**
 * Standard rate limiter to prevent API abuse.
 * Allows 100 requests per 15 minutes per IP address.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes.",
  },
});

/**
 * Stricter rate limiter specifically for contact form submissions.
 * Allows 5 submissions per hour per IP to prevent spam.
 */
export const contactSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many contact requests from this IP. Please wait an hour before submitting again.",
  },
});
