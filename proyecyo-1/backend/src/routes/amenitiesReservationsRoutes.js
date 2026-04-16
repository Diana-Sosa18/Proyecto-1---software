const express = require("express");

const {
  getAmenities,
  getAmenitiesReservations,
  postAmenityReservation,
} = require("../controllers/amenitiesReservationsController");
const { requireResident } = require("../middlewares/requireResident");

const router = express.Router();

router.get("/amenidades", requireResident, getAmenities);
router.get("/reservas/amenidades", requireResident, getAmenitiesReservations);
router.post("/reservas/amenidades", requireResident, postAmenityReservation);

module.exports = router;
