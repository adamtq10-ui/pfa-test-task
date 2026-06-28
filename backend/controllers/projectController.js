const db = require("../db");

// ── GET ALL PROJECTS (whole workspace) ────────────────────
exports.getAllProjects = (req, res) => {
  try {
    const projects = db.projects.findByWorkspace(req.user.workspace_id);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── CREATE PROJECT ─────────────────────────────────────────
exports.createProject = (req, res) => {
  const { name, description, color } = req.body;
  const user_id = req.user.id;
  const workspace_id = req.user.workspace_id;

  if (!name) return res.status(400).json({ message: "Project name is required." });

  try {
    const id = db.projects.create({ name, description, color, user_id, workspace_id });
    db.activity.log(user_id, `Created project "${name}"`);
    res.status(201).json({ id, name, status: "active" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── UPDATE PROJECT ─────────────────────────────────────────
exports.updateProject = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const project = db.projects.findById(id);

    if (!project) return res.status(404).json({ message: "Project not found." });
    if (project.workspace_id !== req.user.workspace_id)
      return res.status(403).json({ message: "This project belongs to a different workspace." });

    const { name, description, color, status } = req.body;
    db.projects.update(id, { name, description, color, status });
    db.activity.log(req.user.id, `Updated project "${name || project.name}"`);

    res.json({ message: "Project updated." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE PROJECT ─────────────────────────────────────────
exports.deleteProject = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const project = db.projects.findById(id);

    if (!project) return res.status(404).json({ message: "Project not found." });
    if (project.workspace_id !== req.user.workspace_id)
      return res.status(403).json({ message: "This project belongs to a different workspace." });

    db.projects.delete(id);
    db.activity.log(req.user.id, `Deleted project "${project.name}"`);

    res.json({ message: "Project deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
