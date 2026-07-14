import mongoose, { Schema, Document } from "mongoose";

export interface IWebsiteSurvey extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  newsletterConsent: boolean;
  formName: string;
  createdAt: Date;
}

const WebsiteSurveySchema: Schema = new Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phoneNumber: { type: String, trim: true },
  newsletterConsent: { type: Boolean, default: false },
  formName: { type: String, default: "Website Survey", required: true },
  createdAt: { type: Date, default: Date.now }
});

export const WebsiteSurvey = mongoose.models.WebsiteSurvey || mongoose.model<IWebsiteSurvey>("WebsiteSurvey", WebsiteSurveySchema, "WebsiteSurvey");
