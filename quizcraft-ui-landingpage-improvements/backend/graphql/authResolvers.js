// backend/graphql/authResolvers.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const mongoose = require("mongoose");

// ---- Config
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ---- Normalize the User import
let ImportedUser = null;
try {
  ImportedUser = require("../models/User");
} catch {
  ImportedUser = null;
}

let User =
  (ImportedUser &&
    (ImportedUser.User || ImportedUser.default || ImportedUser)) ||
  null;

// Fallback model definition if import didn't resolve properly
if (!User || typeof User.findOne !== "function") {
  const userSchema = new mongoose.Schema(
    {
      username: String,
      name: String,
      email: {
        type: String,
        required: true,
        unique: true,
        index: true,
        lowercase: true,
        trim: true,
      },
      passwordHash: String,
      password: String,
      provider: {
        type: String,
        enum: ["local", "google"],
        default: "local",
        index: true,
      },
      googleId: { type: String, index: true },
    },
    { timestamps: true }
  );
  User = mongoose.models.User || mongoose.model("User", userSchema);
}

// ---- Helpers
const signToken = (u) =>
  jwt.sign({ id: u._id, email: u.email }, JWT_SECRET, {
    expiresIn: "7d",
  });

// 🔧 MAIN FIX: make this work with both context=req and context={req}
const getUserFromReq = async (ctxOrReq) => {
  try {
    // Support both: context = req  OR  context = { req }
    const req =
      ctxOrReq && ctxOrReq.headers
        ? ctxOrReq
        : ctxOrReq && ctxOrReq.req
        ? ctxOrReq.req
        : null;

    if (!req || !req.headers) {
      console.warn(
        "[AUTH] No req/headers on context passed to getUserFromReq"
      );
      return null;
    }

    const header = req.headers.authorization || "";
    console.log("[AUTH] Authorization header:", header); // TEMP debug

    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);
    return await User.findById(decoded.id);
  } catch (e) {
    console.warn("[AUTH] getUserFromReq failed:", e.message);
    return null;
  }
};

// ---- Resolvers
module.exports = {
  // Export the helper so other resolvers can use it
  getUserFromReq,

  // Queries
  _health: () => "OK",

  // 🔧 FIXED SIGNATURE: (root, args, context)
  me: async (_root, _args, context) => {
    const user = await getUserFromReq(context);
    if (!user) return null;
    return {
      id: user._id.toString(),
      username: user.username || user.name || null,
      email: user.email,
      provider: user.provider,
      createdAt: user.createdAt?.toISOString(),
      updatedAt: user.updatedAt?.toISOString(),
    };
  },

  // Mutations
  register: async ({ input }) => {
    const { username, email, password } = input || {};
    const errs = [];

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRe.test(String(email).trim()))
      errs.push("Valid email required");
    if (!username || String(username).trim().length < 3)
      errs.push("Username min 3 chars");
    if (!password || password.length < 8)
      errs.push("Password min 8 chars");
    if (
      password &&
      (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    )
      errs.push("Password must include letters and numbers");

    if (errs.length) throw new Error(errs.join(" | "));

    const exists = await User.findOne({
      email: String(email).toLowerCase(),
    });
    if (exists) throw new Error("Email already in use");

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      name: username,
      email: String(email).toLowerCase().trim(),
      passwordHash,
      password: passwordHash,
      provider: "local",
    });

    return { token: signToken(user), user };
  },

  login: async ({ email, password }) => {
    const user = await User.findOne({ email, provider: "local" });
    if (!user) throw new Error("Invalid credentials");

    const storedHash = user.passwordHash || user.password || "";
    const ok = await bcrypt.compare(password || "", storedHash);
    if (!ok) throw new Error("Invalid credentials");

    return { token: signToken(user), user };
  },

  googleAuth: async ({ credential }) => {
    if (!credential) throw new Error("Missing Google credential");
    if (!GOOGLE_CLIENT_ID)
      throw new Error("Server missing GOOGLE_CLIENT_ID");

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid Google token");
    if (payload.aud !== GOOGLE_CLIENT_ID)
      throw new Error("Google token audience mismatch");

    const { sub: googleId, email, name } = payload;
    if (!email) throw new Error("Google did not provide an email");

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        username: name,
        name,
        provider: "google",
        googleId,
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      if (!user.username && user.name) user.username = user.name;
      await user.save();
    }

    return { token: signToken(user), user };
  },
};
