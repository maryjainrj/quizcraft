// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

// Use the SAME secret as server.js (with the same fallback)
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1].trim();

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Normalize to the shape your routes expect
    req.user = {
      id: decoded.id,          // 👈 this is what QuestionSet route uses
      email: decoded.email || "",
    };

    // Optional: debug log (remove later if you want)
    console.log("[authMiddleware] user:", req.user);

    next();
  } catch (err) {
    console.error("[authMiddleware] token error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
