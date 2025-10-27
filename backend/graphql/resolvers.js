// graphql/resolvers.js
const Question = require("../models/Question");
const User = require("../models/User");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- helpers ---
const sign = (u) =>
  jwt.sign(
    { id: u._id.toString(), email: u.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

const toDTO = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  username: u.username,
  provider: u.provider,
  avatarUrl: u.avatarUrl,
});

const rxEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// --- resolvers ---
const resolvers = {
  // ===== Queries =====
  questions: async () => {
    try { return await Question.find(); }
    catch { throw new Error("Error fetching questions"); }
  },

  question: async ({ id }) => {
    try { return await Question.findById(id); }
    catch { throw new Error("Error fetching question"); }
  },

  questionsByTopic: async ({ topic }) => {
    try { return await Question.find({ topic }); }
    catch { throw new Error("Error fetching questions by topic"); }
  },

  // current user from JWT context (requires server to set context.user)
  me: async (_, __, { user }) => {
    if (!user?.id) return null;
    const u = await User.findById(user.id);
    return u ? toDTO(u) : null;
  },

  // ===== Mutations (questions) =====
  createQuestion: async ({ input }) => {
    try {
      const { question, options, correctAnswer, difficulty, topic } = input;
      const doc = new Question({ question, options, correctAnswer, difficulty, topic });
      return await doc.save();
    } catch {
      throw new Error("Error creating question");
    }
  },

  updateQuestion: async ({ id, input }) => {
    try {
      return await Question.findByIdAndUpdate(id, { $set: input }, { new: true });
    } catch {
      throw new Error("Error updating question");
    }
  },

  deleteQuestion: async ({ id }) => {
    try { await Question.findByIdAndDelete(id); return true; }
    catch { throw new Error("Error deleting question"); }
  },

  // ===== Auth Mutations =====
  // register accepts optional username; if absent derives from email local-part
  register: async ({ name, email, password, username }) => {
    try {
      const e = String(email || "").toLowerCase().trim();

      // derive username if not provided
      let uname = String(username || "").trim().toLowerCase();
      if (!uname && e.includes("@")) uname = e.split("@")[0];

      // ensure username uniqueness (if present)
      let finalUsername = uname || null;
      if (finalUsername) {
        let suffix = 0;
        while (suffix < 100) {
          const candidate = suffix ? `${finalUsername}${suffix}` : finalUsername;
          const existsU = await User.findOne({ username: candidate });
          if (!existsU) { finalUsername = candidate; break; }
          suffix++;
        }
      }

      const emailExists = await User.findOne({ email: e });
      if (emailExists) throw new Error("Email already registered");

      const hash = await bcrypt.hash(String(password || ""), 12);

      const user = await User.create({
        name,
        email: e,
        username: finalUsername || undefined,
        password: hash,
        provider: "local",
      });

      const token = sign(user);
      return { token, user: toDTO(user) };
    } catch (error) {
      throw new Error(error.message || "Error during registration");
    }
  },

  // LOGIN: your schema arg is called "email" but we treat it as IDENTIFIER (email OR username)
  login: async ({ email, password }) => {
    try {
      const identifierRaw = String(email || "").trim();
      const lower = identifierRaw.toLowerCase();

      let user = null;
      if (lower.includes("@")) {
        // email path
        user = await User.findOne({ email: lower });
      } else {
        // username path first
        user = await User.findOne({ username: lower });
        // fallback: match by email local-part (e.g., "basu" → /^basu@/i)
        if (!user) {
          user = await User.findOne({
            email: { $regex: `^${rxEscape(lower)}@`, $options: "i" },
          });
        }
      }

      if (!user || !user.password) throw new Error("Invalid credentials");

      const ok = await bcrypt.compare(String(password || ""), user.password);
      if (!ok) throw new Error("Invalid credentials");

      const token = sign(user);
      return { token, user: toDTO(user) };
    } catch (error) {
      throw new Error(error.message || "Error during login");
    }
  },

  googleLogin: async ({ credential }) => {
    try {
      if (!credential) throw new Error("Missing Google credential");

      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const p = ticket.getPayload();
      if (!p?.email_verified) throw new Error("Google email not verified");

      const e = String(p.email).toLowerCase().trim();
      let user = await User.findOne({ email: e });

      if (!user) {
        // create a unique username from email local-part
        const base = e.includes("@") ? e.split("@")[0] : null;
        let finalU = base;
        if (finalU) {
          let suffix = 0;
          while (suffix < 100) {
            const candidate = suffix ? `${finalU}${suffix}` : finalU;
            const existsU = await User.findOne({ username: candidate });
            if (!existsU) { finalU = candidate; break; }
            suffix++;
          }
        }

        user = await User.create({
          name: p.name,
          email: e,
          username: finalU || undefined,
          provider: "google",
          googleId: p.sub,
          avatarUrl: p.picture,
        });
      } else if (user.provider === "local" && !user.googleId) {
        user.provider = "google";
        user.googleId = p.sub;
        user.avatarUrl = user.avatarUrl || p.picture;
        await user.save();
      }

      const token = sign(user);
      return { token, user: toDTO(user) };
    } catch (error) {
      throw new Error(error.message || "Error during Google Sign-In");
    }
  },
};

module.exports = resolvers;
