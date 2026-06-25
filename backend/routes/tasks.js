const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/taskController");
const auth    = require("../middleware/authMiddleware");

router.use(auth);

// Stats & activity first (before /:id to avoid param collision)
router.get("/stats/weekly", ctrl.getWeeklyStats);
router.get("/activity",     ctrl.getActivity);

// CRUD
router.get("/",      ctrl.getAllTasks);
router.post("/",     ctrl.createTask);
router.put("/:id",   ctrl.updateTask);
router.patch("/:id", ctrl.patchTaskStatus);
router.delete("/:id",ctrl.deleteTask);

module.exports = router;
