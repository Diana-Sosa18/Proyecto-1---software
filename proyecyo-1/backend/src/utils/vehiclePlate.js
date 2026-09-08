const MIN_PLATE_LENGTH = 5;
const MAX_PLATE_LENGTH = 12;

function normalizeVehiclePlate(value) {
  const compact = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");

  if (!compact) {
    return "";
  }

  const guatemalaPlate = compact.match(/^(P|C|M|A|O|U|TC|CD|MI)(\d{3}[A-Z]{3})$/);

  return guatemalaPlate ? `${guatemalaPlate[1]}-${guatemalaPlate[2]}` : compact;
}

function validateVehiclePlate(value) {
  const normalized = normalizeVehiclePlate(value);

  if (!normalized) {
    return { value: "", error: null };
  }

  const compact = normalized.replace("-", "");
  const validLength = compact.length >= MIN_PLATE_LENGTH && compact.length <= MAX_PLATE_LENGTH;
  const onlyLettersAndNumbers = /^[A-Z0-9]+$/.test(compact);
  const includesLetter = /[A-Z]/.test(compact);
  const includesNumber = /\d/.test(compact);

  if (!validLength || !onlyLettersAndNumbers || !includesLetter || !includesNumber) {
    return {
      value: normalized,
      error:
        "La placa debe contener entre 5 y 12 letras y números; puede incluir espacios o guiones.",
    };
  }

  return { value: normalized, error: null };
}

function ensureValidVehiclePlate(value) {
  const result = validateVehiclePlate(value);

  if (result.error) {
    const error = new Error(result.error);
    error.status = 400;
    error.code = "INVALID_VEHICLE_PLATE";
    throw error;
  }

  return result.value;
}

module.exports = {
  ensureValidVehiclePlate,
  normalizeVehiclePlate,
  validateVehiclePlate,
};
