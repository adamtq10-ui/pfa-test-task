const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const crypto = require("crypto");
const db     = require("../db");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("../mailer");

// ── REGISTER ──────────────────────────────────────────────
exports.register = async (req, res) => {
  const { user_name, email, password, workspace_mode, workspace_name, invite_code } = req.body;

  if (!user_name || !email || !password)
    return res.status(400).json({ message: "All fields are required." });

  if (password.length < 8)
    return res.status(400).json({ message: "Password must be at least 8 characters." });

  // Resolve which workspace this user will join
  let workspace_id;
  let resultWorkspace = null;

  if (workspace_mode === "join") {
    if (!invite_code) return res.status(400).json({ message: "Invite code is required to join a workspace." });
    const ws = db.workspaces.findByInviteCode(invite_code.trim());
    if (!ws) return res.status(404).json({ message: "Invalid invite code." });
    workspace_id = ws.id;
    resultWorkspace = { id: ws.id, name: ws.name };
  } else {
    // default: create a new workspace
    if (!workspace_name) return res.status(400).json({ message: "Workspace name is required." });
    // workspace gets created after we know the new user's id (created_by), so defer
  }

  try {
    if (db.users.findByEmail(email).length > 0)
      return res.status(409).json({ message: "An account with this email already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);

    if (workspace_mode === "join") {
      const userId = db.users.create({ user_name, email, password: hashedPassword, workspace_id });
      sendWelcomeEmail(email, user_name, resultWorkspace?.name); // fire-and-forget, doesn't block response
      return res.status(201).json({
        message: "Account created successfully.",
        workspace: resultWorkspace,
      });
    } else {
      // Create user first (without workspace_id yet is not possible since schema expects it —
      // create the workspace first using a temporary owner reference, then patch user with it)
      const userId = db.users.create({ user_name, email, password: hashedPassword, workspace_id: null });
      const { id: newWorkspaceId, invite_code: newInviteCode } = db.workspaces.create({ name: workspace_name, created_by: userId });
      db.users.updateWorkspace(userId, newWorkspaceId);
      sendWelcomeEmail(email, user_name, workspace_name); // fire-and-forget, doesn't block response

      return res.status(201).json({
        message: "Account and workspace created successfully.",
        workspace: { id: newWorkspaceId, name: workspace_name, invite_code: newInviteCode },
      });
    }
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
      { id: user.id, user_name: user.user_name, role: user.role || "user", workspace_id: user.workspace_id },
      process.env.JWT_SECRET || "taskflow_secret_dev",
      { expiresIn: "7d" }
    );

    const workspace = db.workspaces.findById(user.workspace_id);

    res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        user_name: user.user_name,
        email: user.email,
        role: user.role || "user",
        workspace_id: user.workspace_id,
        workspace_name: workspace ? workspace.name : null,
      },
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

// ── GET WORKSPACE INFO ────────────────────────────────────
exports.getWorkspaceInfo = (req, res) => {
  try {
    const workspace = db.workspaces.findById(req.user.workspace_id);
    if (!workspace) return res.status(404).json({ message: "Workspace not found." });

    const members = db.users
      .findAll()
      .filter(u => u.workspace_id === workspace.id)
      .map(({ id, user_name, email, role }) => ({ id, user_name, email, role }));

    res.json({
      id: workspace.id,
      name: workspace.name,
      invite_code: workspace.invite_code,
      member_count: members.length,
      members,
    });
  } catch (err) {
    console.error("Get workspace error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ── FORGOT PASSWORD ───────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required." });

  try {
    const rows = db.users.findByEmail(email);
    // Always respond the same way whether or not the email exists, to avoid leaking
    // which addresses are registered.
    const genericResponse = { message: "If that email is registered, a reset link has been sent." };

    if (rows.length === 0) return res.status(200).json(genericResponse);

    const user = rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    db.passwordResets.create(user.id, token, expires_at);

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5500"}/index.html?reset_token=${token}`;
    sendPasswordResetEmail(user.email, user.user_name, resetUrl); // fire-and-forget

    res.status(200).json(genericResponse);
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ── RESET PASSWORD ────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  const { token, new_password } = req.body;

  if (!token || !new_password)
    return res.status(400).json({ message: "Token and new password are required." });

  if (new_password.length < 8)
    return res.status(400).json({ message: "Password must be at least 8 characters." });

  try {
    const entry = db.passwordResets.findByToken(token);
    if (!entry) return res.status(400).json({ message: "This reset link is invalid or has expired." });

    const hashed = await bcrypt.hash(new_password, 10);
    db.users.updatePassword(entry.user_id, hashed);
    db.passwordResets.consume(token);

    res.status(200).json({ message: "Password reset successfully. You can now sign in." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error." });
  }
};