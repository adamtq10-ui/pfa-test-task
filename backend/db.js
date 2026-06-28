// db.js — JSON file database (drop-in replacement for mysql2/promise)
// Switch to MySQL later by replacing this file with the mysql2 version.

const fs   = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "db.json");

function read() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function write(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

function nextId(data, table) {
  const id = data._nextId[table];
  data._nextId[table] = id + 1;
  return id;
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code.slice(0, 4) + "-" + code.slice(4);
}

// ── helpers that mimic mysql2 result shape ─────────────────
// All functions return the same [rows] / [result] shape so
// controllers don't need to change when you switch to MySQL.

const db = {

  // Generic query — not used directly, but kept for compat
  query: () => { throw new Error("Use db helpers directly in JSON mode."); },

  // ── WORKSPACES ───────────────────────────────────────────
  workspaces: {
    findById(id) {
      return read().workspaces.find(w => w.id === id) || null;
    },
    findByInviteCode(code) {
      const d = read();
      return d.workspaces.find(w => w.invite_code.toLowerCase() === String(code).toLowerCase()) || null;
    },
    create({ name, created_by }) {
      const d = read();
      const id = nextId(d, "workspaces");
      const invite_code = generateInviteCode();
      const workspace = { id, name, invite_code, created_by, created_at: new Date().toISOString() };
      d.workspaces.push(workspace);
      write(d);
      return { id, invite_code };
    },
    memberCount(id) {
      return read().users.filter(u => u.workspace_id === id).length;
    },
  },

  // ── USERS ────────────────────────────────────────────────
  users: {
    findByEmailOrUsername(emailOrName) {
      const d = read();
      const u = d.users.find(
        u => u.email === emailOrName || u.user_name === emailOrName
      );
      return u ? [u] : [];
    },
    findByEmail(email) {
      const d = read();
      return d.users.filter(u => u.email === email);
    },
    findById(id) {
      const d = read();
      return d.users.find(u => u.id === id) || null;
    },
    findAll() {
      const d = read();
      return d.users.map(u => ({
        ...u,
        task_count: d.tasks.filter(t => t.user_id === u.id).length,
      }));
    },
    create({ user_name, email, password, workspace_id }) {
      const d = read();
      const id = nextId(d, "users");
      const user = { id, user_name, email, password, role: "user", workspace_id, created_at: new Date().toISOString() };
      d.users.push(user);
      write(d);
      return id;
    },
    updateName(id, user_name) {
      const d = read();
      const u = d.users.find(u => u.id === id);
      if (u) u.user_name = user_name;
      write(d);
    },
    updatePassword(id, password) {
      const d = read();
      const u = d.users.find(u => u.id === id);
      if (u) u.password = password;
      write(d);
    },
    updateRole(id, role) {
      const d = read();
      const u = d.users.find(u => u.id === id);
      if (u) u.role = role;
      write(d);
    },
    updateWorkspace(id, workspace_id) {
      const d = read();
      const u = d.users.find(u => u.id === id);
      if (u) u.workspace_id = workspace_id;
      write(d);
    },
    delete(id) {
      const d = read();
      d.users = d.users.filter(u => u.id !== id);
      d.tasks = d.tasks.filter(t => t.user_id !== id);
      d.activity_log = d.activity_log.filter(a => a.user_id !== id);
      write(d);
    },
  },

  // ── TASKS ────────────────────────────────────────────────
  tasks: {
    findByUser(user_id) {
      return read().tasks.filter(t => t.user_id === user_id);
    },
    findByWorkspace(workspace_id) {
      return read().tasks.filter(t => t.workspace_id === workspace_id);
    },
    findById(id) {
      return read().tasks.find(t => t.id === id) || null;
    },
    create({ title, user_id, workspace_id, assignee, priority, due_date, status, project_id }) {
      const d = read();
      const id = nextId(d, "tasks");
      const task = {
        id,
        user_id,
        workspace_id,
        project_id: project_id || null,
        title,
        status: status || "todo",
        priority: priority || "Medium",
        assignee: assignee || "No one",
        due_date: due_date || null,
        created_at: new Date().toISOString(),
      };
      d.tasks.push(task);
      write(d);
      return id;
    },
    update(id, { title, status, assignee, priority, due_date, project_id }) {
      const d = read();
      const t = d.tasks.find(t => t.id === id);
      if (t) {
        t.title      = title      ?? t.title;
        t.status     = status     ?? t.status;
        t.assignee   = assignee   ?? t.assignee;
        t.priority   = priority   ?? t.priority;
        t.due_date   = due_date   !== undefined ? due_date   : t.due_date;
        t.project_id = project_id !== undefined ? project_id : t.project_id;
      }
      write(d);
    },
    patchStatus(id, status) {
      const d = read();
      const t = d.tasks.find(t => t.id === id);
      if (t) t.status = status;
      write(d);
    },
    delete(id) {
      const d = read();
      d.tasks = d.tasks.filter(t => t.id !== id);
      write(d);
    },
    weeklyStats(workspace_id) {
      const d = read();
      const result = [0, 0, 0, 0, 0, 0, 0];
      const now = Date.now();
      const pool = workspace_id ? d.tasks.filter(t => t.workspace_id === workspace_id) : d.tasks;
      pool.forEach(t => {
        const age = now - new Date(t.created_at).getTime();
        if (age <= 7 * 86400000) {
          const day = new Date(t.created_at).getDay(); // 0=Sun
          result[day]++;
        }
      });
      return result;
    },
    count() {
      return read().tasks.length;
    },
    countDone() {
      return read().tasks.filter(t => t.status === "done").length;
    },
  },

  // ── PROJECTS ─────────────────────────────────────────────
  projects: {
    findByUser(user_id) {
      const d = read();
      return d.projects
        .filter(p => p.user_id === user_id)
        .map(p => ({
          ...p,
          task_count: d.tasks.filter(t => t.project_id === p.id).length,
        }));
    },
    findByWorkspace(workspace_id) {
      const d = read();
      return d.projects
        .filter(p => p.workspace_id === workspace_id)
        .map(p => ({
          ...p,
          task_count: d.tasks.filter(t => t.project_id === p.id).length,
        }));
    },
    findById(id) {
      return read().projects.find(p => p.id === id) || null;
    },
    create({ name, description, color, user_id, workspace_id }) {
      const d = read();
      const id = nextId(d, "projects");
      const project = {
        id,
        user_id,
        workspace_id,
        name,
        description: description || "",
        color: color || "#2563eb",
        status: "active",
        created_at: new Date().toISOString(),
      };
      d.projects.push(project);
      write(d);
      return id;
    },
    update(id, { name, description, color, status }) {
      const d = read();
      const p = d.projects.find(p => p.id === id);
      if (p) {
        p.name        = name        ?? p.name;
        p.description = description !== undefined ? description : p.description;
        p.color       = color       ?? p.color;
        p.status      = status      ?? p.status;
      }
      write(d);
    },
    delete(id) {
      const d = read();
      d.projects = d.projects.filter(p => p.id !== id);
      // Unlink any tasks pointing at this project rather than deleting them
      d.tasks.forEach(t => { if (t.project_id === id) t.project_id = null; });
      write(d);
    },
  },

  // ── ACTIVITY LOG ─────────────────────────────────────────
  // ── PASSWORD RESETS ───────────────────────────────────────
  passwordResets: {
    create(user_id, token, expires_at) {
      const d = read();
      if (!d.password_resets) d.password_resets = [];
      // Invalidate any previous tokens for this user
      d.password_resets = d.password_resets.filter(r => r.user_id !== user_id);
      d.password_resets.push({ user_id, token, expires_at, created_at: new Date().toISOString() });
      write(d);
    },
    findByToken(token) {
      const d = read();
      const entry = (d.password_resets || []).find(r => r.token === token);
      if (!entry) return null;
      if (new Date(entry.expires_at).getTime() < Date.now()) return null; // expired
      return entry;
    },
    consume(token) {
      const d = read();
      d.password_resets = (d.password_resets || []).filter(r => r.token !== token);
      write(d);
    },
  },

  activity: {
    log(user_id, action) {
      const d = read();
      const id = nextId(d, "activity_log");
      d.activity_log.push({ id, user_id, action, created_at: new Date().toISOString() });
      write(d);
    },
    forUser(user_id, limit = 10) {
      return read()
        .activity_log.filter(a => a.user_id === user_id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);
    },
    forWorkspace(workspace_id, limit = 10) {
      const d = read();
      const memberIds = new Set(d.users.filter(u => u.workspace_id === workspace_id).map(u => u.id));
      return d.activity_log
        .filter(a => memberIds.has(a.user_id))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit)
        .map(a => ({
          ...a,
          user_name: (d.users.find(u => u.id === a.user_id) || {}).user_name || "Unknown",
        }));
    },
    all(limit = 50) {
      const d = read();
      return d.activity_log
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit)
        .map(a => ({
          ...a,
          user_name: (d.users.find(u => u.id === a.user_id) || {}).user_name || "Unknown",
        }));
    },
  },
};

module.exports = db;
