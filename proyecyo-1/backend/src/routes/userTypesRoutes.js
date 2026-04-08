const express = require("express");
const { getUserTypes } = require("../controllers/userTypesController");

const router = express.Router();

router.get("/", getUserTypes);

module.exports = router;
