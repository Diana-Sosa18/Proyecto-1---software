const express = require("express");

const {
  getAmenities,
  getReservableAmenitiesUsers,
  getAmenitiesReservations,
  getAdminAmenitiesReservations,
  getAmenitiesAvailability,
  getAdminAmenitiesAvailability,
  getAmenitiesConflict,
  getAdminAmenitiesConflict,
  postAmenityReservation,
  postAdminAmenityReservation,
  putAdminAmenitySchedule,
} = require("../controllers/amenitiesReservationsController");
const { requireResident } = require("../middlewares/requireResident");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.get("/amenidades", requireResident, getAmenities);
router.get("/reservas/amenidades", requireResident, getAmenitiesReservations);
router.get("/reservas/amenidades/disponibilidad", requireResident, getAmenitiesAvailability);
router.get("/reservas/amenidades/conflicto", requireResident, getAmenitiesConflict);
router.post("/reservas/amenidades", requireResident, postAmenityReservation);

router.get("/admin/amenidades", requireAdmin, getAmenities);
router.get("/admin/amenidades/usuarios", requireAdmin, getReservableAmenitiesUsers);
router.put("/admin/amenidades/:id/horario", requireAdmin, putAdminAmenitySchedule);
router.get("/admin/reservas/amenidades", requireAdmin, getAdminAmenitiesReservations);
router.get(
  "/admin/reservas/amenidades/disponibilidad",
  requireAdmin,
  getAdminAmenitiesAvailability,
);
router.get("/admin/reservas/amenidades/conflicto", requireAdmin, getAdminAmenitiesConflict);
router.post("/admin/reservas/amenidades", requireAdmin, postAdminAmenityReservation);

module.exports = router;
