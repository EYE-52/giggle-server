const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const MAX_SQUAD_MEMBERS = toPositiveInt(process.env.MAX_SQUAD_MEMBERS, 4);
const MIN_MEMBERS_TO_SEARCH = toPositiveInt(process.env.MIN_MEMBERS_TO_SEARCH, 2);
const ENABLE_REQUEST_LOGS = process.env.ENABLE_REQUEST_LOGS !== "false";
const LOG_REQUEST_BODY = process.env.LOG_REQUEST_BODY === "true";

module.exports = {
  MAX_SQUAD_MEMBERS,
  MIN_MEMBERS_TO_SEARCH,
  ENABLE_REQUEST_LOGS,
  LOG_REQUEST_BODY,
};
