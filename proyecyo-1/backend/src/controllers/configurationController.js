const {
  getVisitScheduleConfig,
  updateVisitScheduleConfig,
} = require("../services/configurationService");

async function getVisitSchedule(_req, res, next) {
  try {
    const schedule = await getVisitScheduleConfig();
    res.status(200).json(schedule);
  } catch (error) {
    next(error);
  }
}

async function updateVisitSchedule(req, res, next) {
  try {
    const schedule = await updateVisitScheduleConfig(req.body || {});
    res.status(200).json(schedule);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getVisitSchedule,
  updateVisitSchedule,
};
