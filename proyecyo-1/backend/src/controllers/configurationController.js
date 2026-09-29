const {
  getVisitScheduleConfig,
  updateVisitScheduleConfig,
} = require("../services/configurationService");
const { getRequestMetadata, recordAudit } = require("../services/auditService");

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
    const previous = await getVisitScheduleConfig();
    const schedule = await updateVisitScheduleConfig(req.body || {});
    await recordAudit({ userId: req.authUser.id, action: "VISIT_SCHEDULE_UPDATED", entity: "CONFIGURACION", entityId: "horarios-visita", previousData: previous, newData: schedule, metadata: getRequestMetadata(req) });
    res.status(200).json(schedule);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getVisitSchedule,
  updateVisitSchedule,
};
