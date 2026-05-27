const express = require("express");

const {
  getAnnouncements,
  postAnnouncement,
} = require("../controllers/announcementsController");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/admin/comunicados", requireAdmin, getAnnouncements);
router.post("/admin/comunicados", requireAdmin, postAnnouncement);

module.exports = router;
