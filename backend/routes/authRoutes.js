// routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");

const router = express.Router();

function sign(user) {
  return jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/* REGISTER (local) */
router.post("/register", async (req, res) => {
  try {
    let { name, email, username, password } = req.body;
    if (!email || !password) return res.status(400).send("Missing fields");

    email = String(email).trim().toLowerCase();
    if (username) username = String(username).trim().toLowerCase();

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).send("Email already in use");

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      username,
      passwordHash: hash,
      provider: "local",
    });

    return res.json({
      token: sign(user),
      user: { id: user._id, name: user.name, email: user.email, username: user.username },
    });
  } catch (e) {
    console.error("[register] error:", e);
    res.status(500).send("Server error");
  }
});

/* LOGIN (local) */

router.post("/login", async (req, res) => {
  try {
    let { identifier, password } = req.body; // email OR username
    if (!identifier || !password) return res.status(400).send("Missing fields");

    identifier = String(identifier).trim();
    const isEmail = identifier.includes("@");
    const query = isEmail
      ? { email: identifier.toLowerCase() }
      : { username: identifier.toLowerCase() };

    const user = await User.findOne(query);

    const storedHash = user && (user.passwordHash || user.password);
    if (!user || !storedHash) {
      return res.status(401).send("Invalid credentials");
    }

    const ok = await bcrypt.compare(password, storedHash);
    if (!ok) return res.status(401).send("Invalid credentials");

    return res.json({
      token: sign(user),
      user: { id: user._id, name: user.name, email: user.email, username: user.username },
    });
  } catch (e) {
    console.error("[login] error:", e);
    res.status(500).send("Server error");
  }
});

/* GOOGLE SIGN-IN  */
let googleClient = null;
if (process.env.GOOGLE_CLIENT_ID) {
  googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
}

router.post("/google", async (req, res) => {
  try {
    const { id_token } = req.body;
    if (!googleClient || !id_token) return res.status(400).send("Missing Google token");

    const ticket = await googleClient.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload(); // { email, name, picture, sub }

    const email = String(payload.email).toLowerCase();

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name: payload.name,
        googleId: payload.sub,
        avatar: payload.picture,
        provider: "google",
      });
    } else if (!user.googleId) {
      user.googleId = payload.sub;
      user.avatar = user.avatar || payload.picture;
      user.provider = user.provider || "google";
      await user.save();
    }

    return res.json({
      token: sign(user),
      user: { id: user._id, name: user.name, email: user.email, username: user.username },
    });
  } catch (e) {
    console.error("[google] error:", e);
    res.status(401).send("Google auth failed");
  }
});


router.post("/set-password", async (req, res) => {
  try {
    let { identifier, password } = req.body; // email or username
    if (!identifier || !password) return res.status(400).send("Missing fields");

    identifier = String(identifier).trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });
    if (!user) return res.status(404).send("User not found");
    if (user.passwordHash || user.password) return res.status(400).send("Password already set");

    user.passwordHash = await bcrypt.hash(password, 12);
    user.provider = user.provider || "local";
    await user.save();

    res.json({ ok: true });
  } catch (e) {
    console.error("[set-password] error:", e);
    res.status(500).send("Server error");
  }
});

module.exports = router;
