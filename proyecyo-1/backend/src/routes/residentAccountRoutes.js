const express = require("express");

const { getResidentAccountStatement } = require("../controllers/residentAccountController");
const { requireResident } = require("../middlewares/requireResident");

const router = express.Router();

router.get("/residente/estado-cuenta", requireResident, getResidentAccountStatement);

module.exports = router;
