// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { graphqlHTTP } = require("express-graphql");
const jwt = require("jsonwebtoken");

const schema = require("./graphql/schema");
const resolvers = require("./graphql/resolvers");
const questionRoutes = require("./routes/questionRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

/* ---------- CORS (safe for Express 5) ---------- */
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const corsOptions = {
  origin: [FRONTEND_ORIGIN],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions)); // handles preflight automatically (no wildcard line)

/* ---------- Body parsing ---------- */
app.use(express.json());

/* ---------- Health check ---------- */
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

/* ---------- MongoDB ---------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

/* ---------- REST routes ---------- */
app.use("/api/auth", authRoutes); // login/register/google
app.use("/api", questionRoutes);  // existing quiz routes

/* ---------- GraphQL (with JWT context) ---------- */
function buildContext(req) {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");
  let user = null;
  if (type === "Bearer" && token) {
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // ignore invalid/expired token
    }
  }
  return { user, req };
}

app.use(
  "/graphql",
  graphqlHTTP((req) => ({
    schema,
    rootValue: resolvers,
    graphiql: true,
    context: buildContext(req),
    customFormatErrorFn: (error) => ({
      message: error.message,
      locations: error.locations,
      stack: error.stack ? error.stack.split("\n") : [],
      path: error.path,
    }),
  }))
);

/* ---------- Start server ---------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
  console.log(`CORS allowed origin: ${FRONTEND_ORIGIN}`);
});
