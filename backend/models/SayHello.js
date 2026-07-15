import mongoose from "mongoose";

const SayHelloSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    joinWaitlist: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false }, // Automatically handles the 'createdAt' timestamp
    collection: "SayHello", // Binds specifically to the 'SayHello' collection in MongoDB Atlas
  }
);

// Prevent mongoose compiling the model multiple times
export const SayHello = mongoose.models.SayHello || mongoose.model("SayHello", SayHelloSchema);
