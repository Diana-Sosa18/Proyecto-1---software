const MIN_PLATE_LENGTH = 5;
const MAX_PLATE_LENGTH = 12;

export function normalizeVehiclePlate(value: string) {
  const compact = value.trim().toUpperCase().replace(/[\s-]+/g, "");

  if (!compact) {
    return "";
  }

  const guatemalaPlate = compact.match(/^(P|C|M|A|O|U|TC|CD|MI)(\d{3}[A-Z]{3})$/);

  return guatemalaPlate ? `${guatemalaPlate[1]}-${guatemalaPlate[2]}` : compact;
}

export function getVehiclePlateError(value: string) {
  const normalized = normalizeVehiclePlate(value);

  if (!normalized) {
    return "";
  }

  const compact = normalized.replace("-", "");
  const validLength = compact.length >= MIN_PLATE_LENGTH && compact.length <= MAX_PLATE_LENGTH;
  const onlyLettersAndNumbers = /^[A-Z0-9]+$/.test(compact);
  const includesLetter = /[A-Z]/.test(compact);
  const includesNumber = /\d/.test(compact);

  if (!validLength || !onlyLettersAndNumbers || !includesLetter || !includesNumber) {
    return "La placa debe contener entre 5 y 12 letras y números; puede incluir espacios o guiones.";
  }

  return "";
}
