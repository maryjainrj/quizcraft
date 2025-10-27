// models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },

    // required unique email (lowercased)
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },

   
    password: { type: String },

    provider: { type: String, default: "local", enum: ["local", "google"] },
    googleId: { type: String },
    avatarUrl: { type: String },
  },
  { timestamps: true }
);



module.exports = mongoose.model("User", UserSchema);
