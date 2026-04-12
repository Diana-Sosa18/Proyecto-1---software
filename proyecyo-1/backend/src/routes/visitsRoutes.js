const express = require("express");

const {
  getVisits,
  getFrequentVisitors,
  postVisit,
  removeVisit,
} = require("../controllers/visitsController");
const { requireResident } = require("../middlewares/requireResident");

const router = express.Router();

router.use(requireResident);

router.get("/visitas", getVisits);
router.get("/visitantes-frecuentes", getFrequentVisitors);
router.post("/visitas", postVisit);
router.delete("/visitas/:id", removeVisit);

module.exports = router;
