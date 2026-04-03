const formatDurationMs = (startNs) => {
  const durationNs = process.hrtime.bigint() - startNs;
  return Number(durationNs / 1000000n);
};

const sanitizeBody = (body) => {
  if (!body || typeof body !== "object") return body;

  const redacted = { ...body };
  const secrets = ["password", "token", "accessToken", "refreshToken", "authorization"];

  for (const key of secrets) {
    if (key in redacted) {
      redacted[key] = "[REDACTED]";
    }
  }

  return redacted;
};

const requestLogger = ({ logRequestBody = false } = {}) => {
  return (req, res, next) => {
    const startNs = process.hrtime.bigint();
    const startedAt = new Date().toISOString();

    res.on("finish", () => {
      const durationMs = formatDurationMs(startNs);
      const hasAuthHeader = Boolean(req.headers.authorization);

      const summary = {
        time: startedAt,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
      };

      const details = {
        ip: req.ip,
        userAgent: req.get("user-agent"),
        hasAuthHeader,
        query: req.query,
      };

      if (logRequestBody && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
        details.body = sanitizeBody(req.body);
      }

      console.log("[API]", summary, details);
    });

    next();
  };
};

module.exports = { requestLogger };
