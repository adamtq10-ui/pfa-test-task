const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/projectController");
const auth    = require("../middleware/authMiddleware");

router.use(auth);

// CRUD
router.get("/",      ctrl.getAllProjects);
router.post("/",     ctrl.createProject);
router.put("/:id",   ctrl.updateProject);
router.delete("/:id",ctrl.deleteProject);

module.exports = router;
