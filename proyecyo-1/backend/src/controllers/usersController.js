const {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require("../services/usersService");
const { getRequestMetadata, recordAudit } = require("../services/auditService");

async function getUsers(_req, res, next) {
  try {
    const users = await listUsers();
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
}

async function getUser(req, res, next) {
  try {
    const user = await getUserById(Number(req.params.id));
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

async function postUser(req, res, next) {
  try {
    const user = await createUser(req.body || {});
    await recordAudit({ userId: req.authUser.id, action: "USER_CREATED", entity: "USUARIO", entityId: user.id, newData: user, metadata: getRequestMetadata(req) });
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
}

async function putUser(req, res, next) {
  try {
    const previous = await getUserById(Number(req.params.id));
    const user = await updateUser(Number(req.params.id), req.body || {});
    await recordAudit({ userId: req.authUser.id, action: "USER_UPDATED", entity: "USUARIO", entityId: user.id, previousData: previous, newData: user, metadata: getRequestMetadata(req) });
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

async function removeUser(req, res, next) {
  try {
    const previous = await getUserById(Number(req.params.id));
    const user = await deleteUser(Number(req.params.id));
    await recordAudit({ userId: req.authUser.id, action: "USER_DELETED", entity: "USUARIO", entityId: req.params.id, previousData: previous, newData: user, metadata: getRequestMetadata(req) });
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUsers,
  getUser,
  postUser,
  putUser,
  removeUser,
};
