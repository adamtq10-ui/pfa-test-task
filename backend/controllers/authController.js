const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const db     = require("../db");

// ── REGISTER ──────────────────────────────────────────────
exports.register = async (req, res) => {
  const { user_name, email, password } = req.body;

  if (!user_name || !email || !password)
    return res.status(400).json({ message: "All fields are required." });

  if (password.length < 8)
    return res.status(400).json({ message: "Password must be at least 8 characters." });

  try {
    if (db.users.findByEmail(email).length > 0)
      return res.status(409).json({ message: "An account with this email already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    db.users.create({ user_name, email, password: hashedPassword });

    res.status(201).json({ message: "Account created successfully." });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ── LOGIN ─────────────────────────────────────────────────
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email/username and password are required." });

  try {
    const rows = db.users.findByEmailOrUsername(email);

    if (rows.length === 0)
      return res.status(401).json({ message: "Incorrect email/username or password." });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match)
      return res.status(401).json({ message: "Incorrect email/username or password." });

    const token = jwt.sign(
      { id: user.id, user_name: user.user_name, role: user.role || "user" },
      process.env.JWT_SECRET || "taskflow_secret_dev",
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful.",
      token,
      user: { id: user.id, user_name: user.user_name, email: user.email, role: user.role || "user" },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ── GET ME ────────────────────────────────────────────────
exports.getMe = (req, res) => {
  const user = db.users.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  const { password: _, ...safe } = user;
  res.json(safe);
};

// ── UPDATE PROFILE ────────────────────────────────────────
exports.updateProfile = (req, res) => {
  const { user_name } = req.body;
  if (!user_name) return res.status(400).json({ message: "Username is required." });

  db.users.updateName(req.user.id, user_name);
  res.json({ message: "Profile updated successfully.", user_name });
};

// ── CHANGE PASSWORD ───────────────────────────────────────
exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password)
    return res.status(400).json({ message: "Both passwords are required." });

  if (new_password.length < 8)
    return res.status(400).json({ message: "New password must be at least 8 characters." });

  try {
    const user = db.users.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const match = await bcrypt.compare(current_password, user.password);
    if (!match) return res.status(401).json({ message: "Current password is incorrect." });

    const hashed = await bcrypt.hash(new_password, 10);
    db.users.updatePassword(req.user.id, hashed);

    res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Server error." });
  }
};
