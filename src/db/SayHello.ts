import mongoose, { Schema, Document } from "mongoose";

export interface ISayHello extends Document {
  name: string;
  email: string;
  message: string;
  joinWaitlist: boolean;
  createdAt: Date;
}

const SayHelloSchema: Schema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  message: { type: String, default: "" },
  joinWaitlist: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const SayHello = mongoose.models.SayHello || mongoose.model<ISayHello>("SayHello", SayHelloSchema, "SayHello");
