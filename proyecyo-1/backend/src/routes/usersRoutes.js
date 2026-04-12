const express = require("express");

const {
  getUsers,
  getUser,
  postUser,
  putUser,
  removeUser,
} = require("../controllers/usersController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/usuarios", requireAdmin, getUsers);
router.get("/usuarios/:id", requireAdmin, getUser);
router.post("/usuarios", requireAdmin, postUser);
router.put("/usuarios/:id", requireAdmin, putUser);
router.delete("/usuarios/:id", requireAdmin, removeUser);

module.exports = router;
