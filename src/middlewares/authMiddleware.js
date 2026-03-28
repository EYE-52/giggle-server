const jwt = require("jsonwebtoken");

const requireApiAuth = (req, res, next) => {
  const token = req.cookies.sessionToken || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user payload to request
    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
    });
  }
};

const attachGiggleIdentity = (req, res, next) => {
  // This is a placeholder. In a real application, you would resolve
  // userId, providerAccountId, name, email, image from the decoded JWT
  // and potentially a database lookup based on providerAccountId.
  // For now, we'll mock it based on the decoded JWT from Auth.js.
  if (req.user) {
    req.giggleIdentity = {
      userId: req.user.sub, // 'sub' is typically the user ID in JWTs
      provider: "google", // Assuming Google OAuth for MVP
      providerAccountId: req.user.providerAccountId || req.user.sub, // Placeholder
      name: req.user.name,
      email: req.user.email,
      image: req.user.image,
    };
  }
  next();
};

const requireSquadMember = (req, res, next) => {
  // This middleware would typically check if the authenticated user
  // is a member of the squad specified in the request (e.g., via squadId in params).
  // For now, we'll just ensure a giggleIdentity exists.
  if (!req.giggleIdentity || !req.giggleIdentity.userId) {
    return res.status(403).json({
      ok: false,
      error: { code: "FORBIDDEN", message: "Not a squad member" },
    });
  }
  next();
};

const requireSquadLeader = (req, res, next) => {
  // This middleware would check if the authenticated user is the leader
  // of the squad. This would require fetching squad details from the DB.
  // For now, we'll just ensure a giggleIdentity exists as a placeholder.
  if (!req.giggleIdentity || !req.giggleIdentity.userId) {
    return res.status(403).json({
      ok: false,
      error: { code: "LEADER_ONLY", message: "Only squad leader can perform this action" },
    });
  }
  next();
};

module.exports = { requireApiAuth, attachGiggleIdentity, requireSquadMember, requireSquadLeader };
