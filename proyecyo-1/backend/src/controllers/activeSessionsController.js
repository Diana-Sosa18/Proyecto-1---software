const { listActiveSessions, revokeSession } = require("../services/activeSessionsService");

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
    res.status(200).json({ ...result, actual: req.params.sessionId === req.authSessionId });
  } catch (error) {
    next(error);
  }
}

module.exports = { deleteActiveSession, getActiveSessions };
