const {
  listAmenities,
  listReservationsByRange,
  createAmenityReservation,
} = require("../services/amenitiesReservationsService");

async function getAmenities(_req, res, next) {
  try {
    const amenities = await listAmenities();
    res.status(200).json(amenities);
  } catch (error) {
    next(error);
  }
}

async function getAmenitiesReservations(req, res, next) {
  try {
    const reservations = await listReservationsByRange(req.query.from, req.query.to);
    res.status(200).json(reservations);
  } catch (error) {
    next(error);
  }
}

async function postAmenityReservation(req, res, next) {
  try {
    const reservation = await createAmenityReservation(req.authUser.id, req.body || {});
    res.status(201).json(reservation);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAmenities,
  getAmenitiesReservations,
  postAmenityReservation,
};
