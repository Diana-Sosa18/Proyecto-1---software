const {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require("../services/usersService");

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
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
}

async function putUser(req, res, next) {
  try {
    const user = await updateUser(Number(req.params.id), req.body || {});
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

async function removeUser(req, res, next) {
  try {
    const user = await deleteUser(Number(req.params.id));
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
