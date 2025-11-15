// backend/routes/questionSetRoutes.js
const express = require("express");
const jwt = require("jsonwebtoken");
const QuestionSet = require("../models/QuestionSet");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// --- tiny auth middleware JUST for this router ---
function authForQuestionSets(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = header.slice(7); // remove "Bearer "
    const decoded = jwt.verify(token, JWT_SECRET);

    const userId = decoded.id || decoded._id || decoded.userId;
    if (!userId) {
      return res
        .status(401)
        .json({ message: "Token decoded but user id missing" });
    }

    req.user = { id: userId, email: decoded.email };
    next();
  } catch (err) {
    console.error("[questionSet auth] error:", err.message);
    return res
      .status(401)
      .json({ message: "Invalid or expired token for question sets" });
  }
}

// GET /api/questionsets/mine  -> list all sets for this user
router.get("/mine", authForQuestionSets, async (req, res) => {
  try {
    console.log("[/api/questionsets/mine] user id =", req.user.id);

    const sets = await QuestionSet.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    console.log(
      "[/api/questionsets/mine] found",
      sets.length,
      "sets for user"
    );

    // each set already includes createdAt & updatedAt from timestamps
    res.json(sets);
  } catch (err) {
    console.error("Error fetching question sets:", err);
    res.status(500).json({ message: "Failed to load your quizzes" });
  }
});

// GET /api/questionsets/:id  -> single set with its questions
router.get("/:id", authForQuestionSets, async (req, res) => {
  try {
    const { id } = req.params;

    console.log("[/api/questionsets/:id] user id =", req.user.id, "set id =", id);

    const set = await QuestionSet.findOne({
      _id: id,
      createdBy: req.user.id,
    }).populate("questions.question_id"); // pulls QuestionNew docs

    if (!set) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // will include createdAt & updatedAt too
    res.json(set);
  } catch (err) {
    console.error("Error fetching question set by id:", err);
    res.status(500).json({ message: "Failed to load quiz details" });
  }
});

module.exports = router;
