require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const path    = require("path");

const taskRoutes = require("./routes/tasks");
const authRoutes = require("./routes/authRoutes");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(express.json());
app.use(cors());

// ── SERVE FRONTEND ────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../frontend")));

// ── API ROUTES ────────────────────────────────────────────
app.use("/tasks", taskRoutes);
app.use("/users", authRoutes);       // frontend uses /users/login etc.
app.use("/api/auth", authRoutes);    // clean API path

// ── SPA FALLBACK ──────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ── START ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Taskflow running → http://localhost:${PORT}`);
  console.log(`📁  Data stored in  → backend/data/db.json`);
  console.log(`👤  Admin login     → admin@taskflow.io / password`);
});
