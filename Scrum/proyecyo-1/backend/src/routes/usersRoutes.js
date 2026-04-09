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

router.use(requireAdmin);

router.get("/usuarios", getUsers);
router.get("/usuarios/:id", getUser);
router.post("/usuarios", postUser);
router.put("/usuarios/:id", putUser);
router.delete("/usuarios/:id", removeUser);

module.exports = router;
