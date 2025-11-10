// backend/routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../models/User");
const { sendMail } = require("../utils/mailer");

const router = express.Router();

const OTP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const sixDigit = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/request-password-otp
router.post("/request-password-otp", async (req, res) => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });

   
    if (!user) return res.json({ message: "If the email exists, an OTP has been sent." });

    const code = sixDigit();
    user.passwordOtpHash = sha256(code);
    user.passwordOtpExpires = new Date(Date.now() + OTP_WINDOW_MS);
    user.passwordOtpAttempts = 0;
    await user.save();

    // Send via Mailtrap 
    await sendMail({
      to: email,
      subject: "Your QuizCraft password reset code",
      text: `Your OTP is ${code}. It expires in 10 minutes.`,
      html: `<p>Your OTP is <b style="font-size:22px;letter-spacing:3px">${code}</b>. It expires in 10 minutes.</p>`,
    });

    return res.json({ message: "OTP sent to your email." });
  } catch (e) {
    console.error("request-password-otp:", e);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
});

// POST /api/auth/reset-password-otp
router.post("/reset-password-otp", async (req, res) => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const otp = String(req.body?.otp || "").trim();
    const newPassword = String(req.body?.password || "");

    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: "Email, OTP and password are required" });

   
    const user = await User.findOne({ email }).select("+passwordOtpHash +passwordOtpAttempts +passwordOtpExpires");
    if (!user || !user.passwordOtpHash || !user.passwordOtpExpires)
      return res.status(400).json({ message: "Invalid OTP or expired" });

    if (Date.now() > new Date(user.passwordOtpExpires).getTime()) {
      user.passwordOtpHash = undefined;
      user.passwordOtpExpires = undefined;
      user.passwordOtpAttempts = 0;
      await user.save();
      return res.status(400).json({ message: "OTP expired. Request a new one." });
    }

    if (user.passwordOtpAttempts >= OTP_MAX_ATTEMPTS) {
      user.passwordOtpHash = undefined;
      user.passwordOtpExpires = undefined;
      user.passwordOtpAttempts = 0;
      await user.save();
      return res.status(429).json({ message: "Too many attempts. Request a new code." });
    }

    const ok = sha256(otp) === user.passwordOtpHash;
    user.passwordOtpAttempts = (user.passwordOtpAttempts || 0) + 1;

    if (!ok) {
      await user.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hash; // preferred field
    user.password = hash;     
    user.passwordOtpHash = undefined;
    user.passwordOtpExpires = undefined;
    user.passwordOtpAttempts = 0;

    await user.save();
    return res.json({ message: "Password reset successful" });
  } catch (e) {
    console.error("reset-password-otp:", e);
    return res.status(500).json({ message: "Failed to reset password" });
  }
});

module.exports = router;
