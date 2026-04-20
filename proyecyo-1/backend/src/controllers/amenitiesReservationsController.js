const {
  listAmenities,
  listReservableUsers,
  listReservationsByRange,
  getAmenityAvailability,
  validateAmenityReservationConflict,
  createAmenityReservation,
  updateAmenitySchedule,
} = require("../services/amenitiesReservationsService");

function getAdminViewer(req) {
  const headerUserId = Number(req.header("x-user-id"));

  return {
    role: "admin",
    id: Number.isInteger(headerUserId) && headerUserId > 0 ? headerUserId : null,
  };
}

async function getAmenities(_req, res, next) {
  try {
    const amenities = await listAmenities();
    res.status(200).json(amenities);
  } catch (error) {
    next(error);
  }
}

async function getReservableAmenitiesUsers(_req, res, next) {
  try {
    const users = await listReservableUsers();
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
}

async function getAmenitiesReservations(req, res, next) {
  try {
    const reservations = await listReservationsByRange(req.query.from, req.query.to, {
      id_amenidad: req.query.id_amenidad,
      id_usuario: req.query.id_usuario,
      includeUserDetails: false,
    });
    res.status(200).json(reservations);
  } catch (error) {
    next(error);
  }
}

async function getAdminAmenitiesReservations(req, res, next) {
  try {
    const reservations = await listReservationsByRange(req.query.from, req.query.to, {
      id_amenidad: req.query.id_amenidad,
      id_usuario: req.query.id_usuario,
      includeUserDetails: true,
    });
    res.status(200).json(reservations);
  } catch (error) {
    next(error);
  }
}

async function getAmenitiesAvailability(req, res, next) {
  try {
    const availability = await getAmenityAvailability(req.query.id_amenidad, req.query.fecha, {
      includeUserDetails: false,
    });
    res.status(200).json(availability);
  } catch (error) {
    next(error);
  }
}

async function getAdminAmenitiesAvailability(req, res, next) {
  try {
    const availability = await getAmenityAvailability(req.query.id_amenidad, req.query.fecha, {
      includeUserDetails: true,
    });
    res.status(200).json(availability);
  } catch (error) {
    next(error);
  }
}

async function getAmenitiesConflict(req, res, next) {
  try {
    const conflict = await validateAmenityReservationConflict(req.query, {
      includeUserDetails: false,
      requireUserId: false,
    });
    res.status(200).json(conflict);
  } catch (error) {
    next(error);
  }
}

async function getAdminAmenitiesConflict(req, res, next) {
  try {
    const conflict = await validateAmenityReservationConflict(req.query, {
      includeUserDetails: true,
      requireUserId: false,
    });
    res.status(200).json(conflict);
  } catch (error) {
    next(error);
  }
}

async function postAmenityReservation(req, res, next) {
  try {
    const reservation = await createAmenityReservation(req.authUser, req.body || {});
    res.status(201).json(reservation);
  } catch (error) {
    next(error);
  }
}

async function postAdminAmenityReservation(req, res, next) {
  try {
    const reservation = await createAmenityReservation(getAdminViewer(req), req.body || {});
    res.status(201).json(reservation);
  } catch (error) {
    next(error);
  }
}

async function putAdminAmenitySchedule(req, res, next) {
  try {
    const amenity = await updateAmenitySchedule(Number(req.params.id), req.body || {});
    res.status(200).json(amenity);
  } catch (error) {
    next(error);
  }
}

module.exports = {
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
};
