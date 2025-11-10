// backend/models/User.js
const mongoose = require('mongoose');


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

    /* ======== Added for OTP password reset ======== */
    passwordOtpHash: { type: String, select: false },   // SHA-256 of OTP
    passwordOtpExpires: { type: Date },                 // expiry timestamp
    passwordOtpAttempts: { type: Number, default: 0, select: false }, 
    
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
    delete ret.passwordOtpHash;     // keep OTP hash out of responses
    delete ret.passwordOtpAttempts; // keep attempts hidden
    return ret;
  },
});

// export)
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
