const nodemailer = require("nodemailer");

// ── TRANSPORTER ───────────────────────────────────────────
// Uses Gmail SMTP. Requires a Google "App Password" (not your normal password).
// Set these in your .env file:
//   GMAIL_USER=youraddress@gmail.com
//   GMAIL_APP_PASSWORD=your16characterapppassword
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const FROM = `"Taskflow" <${process.env.GMAIL_USER}>`;

// ── SEND WELCOME EMAIL ────────────────────────────────────
async function sendWelcomeEmail(to, userName, workspaceName) {
  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: "Welcome to Taskflow!",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#2563eb;">Welcome, ${userName}! 👋</h2>
          <p>Your Taskflow account is ready${workspaceName ? ` and you've joined the <strong>${workspaceName}</strong> workspace` : ""}.</p>
          <p>You can now sign in and start organizing your tasks.</p>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px;">If you didn't create this account, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    // Don't let a mail failure block registration — just log it.
    console.error("Failed to send welcome email:", err.message);
  }
}

// ── SEND PASSWORD RESET EMAIL ─────────────────────────────
async function sendPasswordResetEmail(to, userName, resetUrl) {
  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: "Reset your Taskflow password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#2563eb;">Password reset request</h2>
          <p>Hi ${userName}, we received a request to reset your password.</p>
          <p style="margin:24px 0;">
            <a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a>
          </p>
          <p style="color:#94a3b8;font-size:12px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send password reset email:", err.message);
  }
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };