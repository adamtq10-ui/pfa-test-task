const db = require("../db");

// ── ADMIN GUARD ───────────────────────────────────────────
exports.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin")
    return res.status(403).json({ message: "Admin access required." });
  next();
};

// ── GET ALL USERS ─────────────────────────────────────────
exports.getAllUsers = (req, res) => {
  try {
    const users = db.users.findAll().map(({ password: _, ...u }) => u);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── UPDATE ROLE ───────────────────────────────────────────
exports.updateUserRole = (req, res) => {
  const { role } = req.body;
  if (!["admin", "user"].includes(role))
    return res.status(400).json({ message: "Invalid role." });

  const id = parseInt(req.params.id);
  if (id === req.user.id)
    return res.status(400).json({ message: "You cannot change your own role." });

  db.users.updateRole(id, role);
  res.json({ message: `User role updated to ${role}.` });
};

// ── DELETE USER ───────────────────────────────────────────
exports.deleteUser = (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id)
    return res.status(400).json({ message: "You cannot delete your own account." });

  db.users.delete(id);
  res.json({ message: "User deleted." });
};

// ── GLOBAL STATS ──────────────────────────────────────────
exports.getStats = (req, res) => {
  try {
    const users   = db.users.findAll();
    const total_users  = users.length;
    const admins       = users.filter(u => u.role === "admin").length;
    const total_tasks  = db.tasks.count();
    const done_tasks   = db.tasks.countDone();
    res.json({ total_users, total_tasks, done_tasks, admins });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GLOBAL ACTIVITY ───────────────────────────────────────
exports.getActivityLog = (req, res) => {
  try {
    res.json(db.activity.all(50));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
