const express = require("express");
const router  = express.Router();

const { register, login, getMe, updateProfile, changePassword } = require("../controllers/authController");
const { requireAdmin, getAllUsers, updateUserRole, deleteUser, getStats, getActivityLog } = require("../controllers/adminController");
const auth = require("../middleware/authMiddleware");

// Public
router.post("/register", register);
router.post("/login",    login);

// Authenticated
router.get("/me",              auth, getMe);
router.put("/profile",         auth, updateProfile);
router.put("/change-password", auth, changePassword);

// Admin
router.get("/admin/stats",           auth, requireAdmin, getStats);
router.get("/admin/users",           auth, requireAdmin, getAllUsers);
router.put("/admin/users/:id/role",  auth, requireAdmin, updateUserRole);
router.delete("/admin/users/:id",    auth, requireAdmin, deleteUser);
router.get("/admin/activity",        auth, requireAdmin, getActivityLog);

module.exports = router;
