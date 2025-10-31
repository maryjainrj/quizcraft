// backend/models/User.js
const mongoose = require('mongoose');

/**
 * User schema that works with BOTH:
 * - your existing docs: { name, email, password, provider }
 * - new fields: { username, passwordHash, googleId }
 */
const userSchema = new mongoose.Schema(
  {
    // New-style username
    username: { type: String, trim: true },

    // Legacy field already in your DB
    name: { type: String, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },

    // New-style hashed password
    passwordHash: { type: String },

    // Legacy hashed password
    password: { type: String },

    provider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
      index: true,
    },

    // Present for Google accounts
    googleId: { type: String, index: true },
  },
  { timestamps: true }
);

// Helpful virtuals (optional)
userSchema.virtual('displayUsername').get(function () {
  return this.username || this.name || '';
});
userSchema.virtual('hashedPassword').get(function () {
  return this.passwordHash || this.password || '';
});

// Clean JSON output
userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.password;
    delete ret.passwordHash;
    return ret;
  },
});

// ✅ Export the model itself (not a named export)
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
