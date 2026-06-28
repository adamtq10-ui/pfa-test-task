const db = require("../db");

// ── GET ALL TASKS (whole workspace) ───────────────────────
exports.getAllTasks = (req, res) => {
  try {
    const tasks = db.tasks.findByWorkspace(req.user.workspace_id);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── CREATE TASK ───────────────────────────────────────────
exports.createTask = (req, res) => {
  const { title, assignee, priority, due_date, status, project_id } = req.body;
  const user_id = req.user.id;
  const workspace_id = req.user.workspace_id;

  if (!title) return res.status(400).json({ error: "Title is required." });

  try {
    const id = db.tasks.create({ title, user_id, workspace_id, assignee, priority, due_date, status, project_id });
    db.activity.log(user_id, `Created task "${title}"`);
    res.status(201).json({ id, title, status: status || "todo" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── UPDATE TASK ───────────────────────────────────────────
exports.updateTask = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = db.tasks.findById(id);
    if (!existing) return res.status(404).json({ message: "Task not found." });
    if (existing.workspace_id !== req.user.workspace_id)
      return res.status(403).json({ message: "This task belongs to a different workspace." });

    const { title, status, assignee, priority, due_date, project_id } = req.body;
    db.tasks.update(id, { title, status, assignee, priority, due_date, project_id });

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
    if (!task) return res.status(404).json({ message: "Task not found." });
    if (task.workspace_id !== req.user.workspace_id)
      return res.status(403).json({ message: "This task belongs to a different workspace." });

    db.tasks.patchStatus(id, status);

    if (status === "done")           db.activity.log(req.user.id, `Completed task "${task.title}"`);
    else if (status === "in_progress") db.activity.log(req.user.id, `Started task "${task.title}"`);
    else                             db.activity.log(req.user.id, `Moved task "${task.title}" to To Do`);

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
    if (!task) return res.status(404).json({ message: "Task not found." });
    if (task.workspace_id !== req.user.workspace_id)
      return res.status(403).json({ message: "This task belongs to a different workspace." });

    db.tasks.delete(id);
    db.activity.log(req.user.id, `Deleted task "${task.title}"`);

    res.json({ message: "Task deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── WEEKLY STATS (whole workspace) ────────────────────────
exports.getWeeklyStats = (req, res) => {
  try {
    res.json(db.tasks.weeklyStats(req.user.workspace_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── ACTIVITY FEED (whole workspace) ───────────────────────
exports.getActivity = (req, res) => {
  try {
    const rows = db.activity.forWorkspace(req.user.workspace_id, 10);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

