const { Squad } = require("../models/Squad");

const getRequesterIdentity = (req) => {
  const identity = req.user || req.giggleIdentity || {};
  const userId = identity.userId || identity.sub;
  const providerAccountId = identity.providerAccountId || userId;

  return {
    userId,
    providerAccountId,
    name: identity.name,
    email: identity.email,
    image: identity.image,
  };
};

const isSameMember = (member, identity) => {
  if (!member || !identity) return false;

  if (identity.userId && member.userId === identity.userId) return true;
  if (identity.providerAccountId && member.providerAccountId === identity.providerAccountId) return true;

  return false;
};

const findSquadForIdentity = async ({ userId, providerAccountId, excludeSquadId } = {}) => {
  const orConditions = [];

  if (userId) {
    orConditions.push({ userId });
  }

  if (providerAccountId) {
    orConditions.push({ providerAccountId });
  }

  if (orConditions.length === 0) {
    return null;
  }

  const query = {
    members: {
      $elemMatch: {
        $or: orConditions,
      },
    },
  };

  if (excludeSquadId) {
    query.squadId = { $ne: excludeSquadId };
  }

  return Squad.findOne(query);
};

const getSquadAccessContext = async ({ squadId, identity }) => {
  const squad = await Squad.findOne({ squadId });
  if (!squad) {
    return { error: { status: 404, code: "SQUAD_NOT_FOUND", message: "Squad not found" } };
  }

  const memberIndex = squad.members.findIndex((member) => isSameMember(member, identity));
  if (memberIndex === -1) {
    return { error: { status: 403, code: "FORBIDDEN", message: "Not a member of this squad" } };
  }

  const member = squad.members[memberIndex];
  const leaderIndex = squad.members.findIndex((candidate) => candidate.role === "leader");
  const leader = leaderIndex >= 0 ? squad.members[leaderIndex] : null;

  return {
    squad,
    member,
    memberIndex,
    leader,
    isLeader: member.role === "leader",
  };
};

const persistSquadAfterMemberRemoval = async (squad, { removedMemberRole }) => {
  let squadDeleted = false;
  let newLeaderMemberId = null;

  if (squad.members.length === 0) {
    await squad.deleteOne();
    squadDeleted = true;
  } else {
    if (removedMemberRole === "leader") {
      squad.members[0].role = "leader";
      newLeaderMemberId = squad.members[0].memberId;
    } else {
      const currentLeader = squad.members.find((member) => member.role === "leader");
      newLeaderMemberId = currentLeader ? currentLeader.memberId : null;
    }

    await squad.save();
  }

  return { squadDeleted, newLeaderMemberId };
};

module.exports = {
  getRequesterIdentity,
  isSameMember,
  findSquadForIdentity,
  getSquadAccessContext,
  persistSquadAfterMemberRemoval,
};
