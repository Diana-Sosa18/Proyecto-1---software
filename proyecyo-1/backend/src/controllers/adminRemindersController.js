const {
  getReminderConfig,
  saveReminderConfig,
  sendPaymentReminders,
  getReminderSummary,
  listReminders,
} = require("../services/adminRemindersService");

async function getAdminReminderConfig(_req, res, next) {
  try {
    const config = await getReminderConfig();
    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
}

async function putAdminReminderConfig(req, res, next) {
  try {
    const config = await saveReminderConfig(req.body || {});
    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
}

async function generateAdminReminders(req, res, next) {
  try {
    const result = await sendPaymentReminders(req.authUser.id);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function getAdminReminderSummary(_req, res, next) {
  try {
    const summary = await getReminderSummary();
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
}

async function getAdminReminders(req, res, next) {
  try {
    const reminders = await listReminders(req.query || {});
    res.status(200).json(reminders);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminReminderConfig,
  putAdminReminderConfig,
  generateAdminReminders,
  getAdminReminderSummary,
  getAdminReminders,
};
