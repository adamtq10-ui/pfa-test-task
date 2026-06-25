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

// ── helpers that mimic mysql2 result shape ─────────────────
// All functions return the same [rows] / [result] shape so
// controllers don't need to change when you switch to MySQL.

const db = {

  // Generic query — not used directly, but kept for compat
  query: () => { throw new Error("Use db helpers directly in JSON mode."); },

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
    create({ user_name, email, password }) {
      const d = read();
      const id = nextId(d, "users");
      const user = { id, user_name, email, password, role: "user", created_at: new Date().toISOString() };
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
    findById(id) {
      return read().tasks.find(t => t.id === id) || null;
    },
    create({ title, user_id, assignee, priority, due_date, status }) {
      const d = read();
      const id = nextId(d, "tasks");
      const task = {
        id,
        user_id,
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
    update(id, { title, status, assignee, priority, due_date }) {
      const d = read();
      const t = d.tasks.find(t => t.id === id);
      if (t) {
        t.title    = title    ?? t.title;
        t.status   = status   ?? t.status;
        t.assignee = assignee ?? t.assignee;
        t.priority = priority ?? t.priority;
        t.due_date = due_date !== undefined ? due_date : t.due_date;
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
    weeklyStats() {
      const d = read();
      const result = [0, 0, 0, 0, 0, 0, 0];
      const now = Date.now();
      d.tasks.forEach(t => {
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

  // ── ACTIVITY LOG ─────────────────────────────────────────
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
