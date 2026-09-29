const { listActiveSessions, revokeSession } = require("../services/activeSessionsService");
const { getRequestMetadata, recordAudit } = require("../services/auditService");

async function getActiveSessions(req, res, next) {
  try {
    const sessions = await listActiveSessions(req.authUser.id, req.authSessionId);
    res.status(200).json(sessions);
  } catch (error) {
    next(error);
  }
}

async function deleteActiveSession(req, res, next) {
  try {
    const result = await revokeSession(req.authUser.id, req.params.sessionId);
    await recordAudit({
      userId: req.authUser.id,
      action: "SESSION_REVOKED",
      entity: "SESION_ACTIVA",
      entityId: req.params.sessionId,
      newData: { actual: req.params.sessionId === req.authSessionId, cerrada: true },
      metadata: getRequestMetadata(req),
    });
    res.status(200).json({ ...result, actual: req.params.sessionId === req.authSessionId });
  } catch (error) {
    next(error);
  }
}

module.exports = { deleteActiveSession, getActiveSessions };
