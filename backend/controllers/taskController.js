const db = require("../db");

// ── GET ALL TASKS ─────────────────────────────────────────
exports.getAllTasks = (req, res) => {
  try {
    const tasks = db.tasks.findByUser(req.user.id);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── CREATE TASK ───────────────────────────────────────────
exports.createTask = (req, res) => {
  const { title, assignee, priority, due_date, status } = req.body;
  const user_id = req.user.id;

  if (!title) return res.status(400).json({ error: "Title is required." });

  try {
    const id = db.tasks.create({ title, user_id, assignee, priority, due_date, status });
    db.activity.log(user_id, `Created task "${title}"`);
    res.status(201).json({ id, title, status: status || "todo" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── UPDATE TASK ───────────────────────────────────────────
exports.updateTask = (req, res) => {
  try {
    const { title, status, assignee, priority, due_date } = req.body;
    const id = parseInt(req.params.id);

    db.tasks.update(id, { title, status, assignee, priority, due_date });

    if (status === "done")        db.activity.log(req.user.id, `Completed task "${title}"`);
    else if (status === "in_progress") db.activity.log(req.user.id, `Started task "${title}"`);
    else                          db.activity.log(req.user.id, `Updated task "${title}"`);

    res.json({ message: "Task updated." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PATCH STATUS (drag-drop) ──────────────────────────────
exports.patchTaskStatus = (req, res) => {
  try {
    const { status } = req.body;
    const id = parseInt(req.params.id);

    if (!["todo", "in_progress", "done"].includes(status))
      return res.status(400).json({ message: "Invalid status." });

    const task = db.tasks.findById(id);
    db.tasks.patchStatus(id, status);

    if (task) {
      if (status === "done")           db.activity.log(req.user.id, `Completed task "${task.title}"`);
      else if (status === "in_progress") db.activity.log(req.user.id, `Started task "${task.title}"`);
      else                             db.activity.log(req.user.id, `Moved task "${task.title}" to To Do`);
    }

    res.json({ message: "Status updated." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE TASK ───────────────────────────────────────────
exports.deleteTask = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const task = db.tasks.findById(id);

    db.tasks.delete(id);

    if (task) db.activity.log(req.user.id, `Deleted task "${task.title}"`);

    res.json({ message: "Task deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── WEEKLY STATS ──────────────────────────────────────────
exports.getWeeklyStats = (req, res) => {
  try {
    res.json(db.tasks.weeklyStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── ACTIVITY FEED (current user) ──────────────────────────
exports.getActivity = (req, res) => {
  try {
    const rows = db.activity.forUser(req.user.id, 10);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
