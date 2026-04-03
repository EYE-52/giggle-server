const { Squad } = require("../models/Squad");
const User = require("../models/User");
const { MAX_SQUAD_MEMBERS, MIN_MEMBERS_TO_SEARCH } = require("../config/appConfig");
const {
  getRequesterIdentity,
  isSameMember,
  findSquadForIdentity,
  persistSquadAfterMemberRemoval,
} = require("../app/squadAccess");
const { generateId, generateSquadCode } = require("../utils/idGenerator");

const getMySquadHandler = async (req, res) => {
  const identity = getRequesterIdentity(req);

  if (!identity.userId) {
    return res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  try {
    const squad = await findSquadForIdentity(identity);
    if (!squad) {
      return res.status(200).json({ ok: true, data: { inSquad: false } });
    }

    const member = squad.members.find((candidate) => isSameMember(candidate, identity));
    const leader = squad.members.find((candidate) => candidate.role === "leader");

    return res.status(200).json({
      ok: true,
      data: {
        inSquad: true,
        squadId: squad.squadId,
        squadCode: squad.squadCode,
        status: squad.status,
        member,
        leaderMemberId: leader ? leader.memberId : null,
        members: squad.members,
      },
    });
  } catch (error) {
    console.error("Error fetching my squad:", error);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch squad" },
    });
  }
};

const createSquadHandler = async (req, res) => {
  const { displayName } = req.body;
  const { userId, providerAccountId, name, email } = getRequesterIdentity(req);

  if (!userId) {
    return res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  try {
    const existingSquad = await findSquadForIdentity({ userId, providerAccountId });
    if (existingSquad) {
      return res.status(409).json({
        ok: false,
        error: {
          code: "ALREADY_IN_SQUAD",
          message: "User is already a member of another squad",
        },
        data: {
          squadId: existingSquad.squadId,
          squadCode: existingSquad.squadCode,
          status: existingSquad.status,
        },
      });
    }

    const squadId = generateId("sq");
    const squadCode = generateSquadCode();
    const memberId = generateId("mem");

    const newMember = {
      memberId,
      userId,
      providerAccountId,
      displayName: displayName || name || email,
      role: "leader",
      ready: false,
      joinedAt: new Date().toISOString(),
    };

    const newSquad = new Squad({
      squadId,
      squadCode,
      status: "idle",
      members: [newMember],
      createdAt: new Date().toISOString(),
    });

    await newSquad.save();

    return res.status(201).json({
      ok: true,
      data: {
        squadId: newSquad.squadId,
        squadCode: newSquad.squadCode,
        member: newMember,
        members: [newMember],
        status: newSquad.status,
      },
    });
  } catch (error) {
    console.error("Error creating squad:", error);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to create squad" },
    });
  }
};

const joinSquadHandler = async (req, res) => {
  const { squadCode, displayName } = req.body;
  const { userId, providerAccountId, name, email } = getRequesterIdentity(req);

  if (!userId) {
    return res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  const normalizedSquadCode = typeof squadCode === "string" ? squadCode.trim().toUpperCase() : "";

  if (!normalizedSquadCode) {
    return res.status(400).json({
      ok: false,
      error: { code: "INVALID_REQUEST", message: "Squad code is required" },
    });
  }

  if (!/^[A-Z]{3}-\d{3}$/.test(normalizedSquadCode)) {
    return res.status(400).json({
      ok: false,
      error: { code: "INVALID_SQUAD_CODE", message: "Squad code must be in format ABC-123" },
    });
  }

  try {
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(401).json({
        ok: false,
        error: { code: "USER_NOT_FOUND", message: "Authenticated user does not exist" },
      });
    }

    const squad = await Squad.findOne({ squadCode: normalizedSquadCode });
    if (!squad) {
      return res.status(404).json({
        ok: false,
        error: { code: "SQUAD_NOT_FOUND", message: "Squad not found" },
      });
    }

    const existingMember = squad.members.find((candidate) => isSameMember(candidate, { userId, providerAccountId }));
    if (existingMember) {
      return res.status(200).json({
        ok: true,
        data: {
          squadId: squad.squadId,
          squadCode: squad.squadCode,
          member: existingMember,
          members: squad.members,
          status: squad.status,
        },
      });
    }

    const otherSquad = await findSquadForIdentity({
      userId,
      providerAccountId,
      excludeSquadId: squad.squadId,
    });

    if (otherSquad) {
      return res.status(409).json({
        ok: false,
        error: {
          code: "ALREADY_IN_ANOTHER_SQUAD",
          message: "User is already a member of another squad",
        },
        data: {
          squadId: otherSquad.squadId,
          squadCode: otherSquad.squadCode,
          status: otherSquad.status,
        },
      });
    }

    if (squad.members.length >= MAX_SQUAD_MEMBERS) {
      return res.status(409).json({
        ok: false,
        error: { code: "SQUAD_FULL", message: `Squad is full (max ${MAX_SQUAD_MEMBERS} members)` },
      });
    }

    if (squad.status !== "idle") {
      return res.status(409).json({
        ok: false,
        error: { code: "SQUAD_CLOSED", message: "Squad is already in a match or encounter" },
      });
    }

    const memberId = generateId("mem");
    const newMember = {
      memberId,
      userId,
      providerAccountId,
      displayName: displayName || name || email,
      role: "member",
      ready: false,
      joinedAt: new Date().toISOString(),
    };

    squad.members.push(newMember);
    await squad.save();

    return res.status(200).json({
      ok: true,
      data: {
        squadId: squad.squadId,
        squadCode: squad.squadCode,
        member: newMember,
        members: squad.members,
        status: squad.status,
      },
    });
  } catch (error) {
    console.error("Error joining squad:", error);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to join squad" },
    });
  }
};

const getSquadHandler = async (req, res) => {
  try {
    const { squad, leader } = req.squadAccess;

    return res.status(200).json({
      ok: true,
      data: {
        squadId: squad.squadId,
        squadCode: squad.squadCode,
        status: squad.status,
        members: squad.members,
        leaderMemberId: leader ? leader.memberId : undefined,
      },
    });
  } catch (error) {
    console.error("Error getting squad lobby state:", error);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to retrieve squad state" },
    });
  }
};

const updateReadyStateHandler = async (req, res) => {
  const { ready } = req.body;

  if (typeof ready !== "boolean") {
    return res.status(400).json({
      ok: false,
      error: { code: "INVALID_REQUEST", message: "Ready state must be a boolean" },
    });
  }

  try {
    const { squad, memberIndex } = req.squadAccess;

    if (squad.status !== "idle" && ready === true) {
      return res.status(409).json({
        ok: false,
        error: {
          code: "INVALID_SQUAD_STATE",
          message: "Cannot change ready state when squad is not idle",
        },
      });
    }

    squad.members[memberIndex].ready = ready;
    await squad.save();

    const updatedMember = squad.members[memberIndex];
    const readyCount = squad.members.filter((candidate) => candidate.ready).length;

    return res.status(200).json({
      ok: true,
      data: {
        squadId: squad.squadId,
        memberId: updatedMember.memberId,
        providerAccountId: updatedMember.providerAccountId,
        ready: updatedMember.ready,
        readyCount,
        totalMembers: squad.members.length,
      },
    });
  } catch (error) {
    console.error("Error updating ready state:", error);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update ready state" },
    });
  }
};

const startSearchHandler = async (req, res) => {
  try {
    const { squad, member } = req.squadAccess;

    if (squad.status !== "idle") {
      return res.status(409).json({
        ok: false,
        error: { code: "INVALID_SQUAD_STATE", message: "Squad must be idle to start search" },
      });
    }

    if (squad.members.length < MIN_MEMBERS_TO_SEARCH) {
      return res.status(409).json({
        ok: false,
        error: {
          code: "NOT_ENOUGH_MEMBERS",
          message: `At least ${MIN_MEMBERS_TO_SEARCH} members are required to start search`,
        },
      });
    }

    const allReady = squad.members.every((candidate) => candidate.ready === true);
    if (!allReady) {
      return res.status(409).json({
        ok: false,
        error: { code: "NOT_READY_TO_SEARCH", message: "All squad members must be ready" },
      });
    }

    squad.status = "searching";
    await squad.save();

    return res.status(200).json({
      ok: true,
      data: {
        squadId: squad.squadId,
        status: squad.status,
        startedByMemberId: member.memberId,
      },
    });
  } catch (error) {
    console.error("Error starting search:", error);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to start search" },
    });
  }
};

const cancelSearchHandler = async (req, res) => {
  try {
    const { squad, member } = req.squadAccess;

    if (squad.status !== "searching") {
      return res.status(409).json({
        ok: false,
        error: { code: "NOT_IN_SEARCH", message: "Squad is not in searching state" },
      });
    }

    squad.status = "idle";
    await squad.save();

    return res.status(200).json({
      ok: true,
      data: {
        squadId: squad.squadId,
        status: squad.status,
        cancelledByMemberId: member.memberId,
      },
    });
  } catch (error) {
    console.error("Error cancelling search:", error);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to cancel search" },
    });
  }
};

const kickMemberHandler = async (req, res) => {
  const { memberId } = req.params;

  try {
    const { squad } = req.squadAccess;
    const targetIndex = squad.members.findIndex((candidate) => candidate.memberId === memberId);

    if (targetIndex === -1) {
      return res.status(404).json({
        ok: false,
        error: { code: "MEMBER_NOT_FOUND", message: "Target member not found in squad" },
      });
    }

    const targetMember = squad.members[targetIndex];
    if (targetMember.role === "leader") {
      return res.status(409).json({
        ok: false,
        error: { code: "LEADER_CANNOT_BE_KICKED", message: "Leader cannot be kicked" },
      });
    }

    squad.members.splice(targetIndex, 1);
    await squad.save();

    return res.status(200).json({
      ok: true,
      data: {
        squadId: squad.squadId,
        kickedMemberId: targetMember.memberId,
        remainingCount: squad.members.length,
        status: squad.status,
      },
    });
  } catch (error) {
    console.error("Error kicking member:", error);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to kick member" },
    });
  }
};

const promoteMemberHandler = async (req, res) => {
  const { memberId } = req.params;

  try {
    const { squad } = req.squadAccess;
    const targetMember = squad.members.find((candidate) => candidate.memberId === memberId);

    if (!targetMember) {
      return res.status(404).json({
        ok: false,
        error: { code: "MEMBER_NOT_FOUND", message: "Target member not found in squad" },
      });
    }

    if (targetMember.role === "leader") {
      return res.status(409).json({
        ok: false,
        error: { code: "ALREADY_LEADER", message: "Target member is already leader" },
      });
    }

    const currentLeader = squad.members.find((candidate) => candidate.role === "leader");
    if (!currentLeader) {
      return res.status(500).json({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "No leader found in squad" },
      });
    }

    currentLeader.role = "member";
    targetMember.role = "leader";

    await squad.save();

    return res.status(200).json({
      ok: true,
      data: {
        squadId: squad.squadId,
        newLeaderMemberId: targetMember.memberId,
        previousLeaderMemberId: currentLeader.memberId,
      },
    });
  } catch (error) {
    console.error("Error promoting member:", error);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to promote member" },
    });
  }
};

const leaveSquadHandler = async (req, res) => {
  try {
    const { squad, memberIndex } = req.squadAccess;
    const leavingMember = squad.members[memberIndex];

    squad.members.splice(memberIndex, 1);

    const { squadDeleted, newLeaderMemberId } = await persistSquadAfterMemberRemoval(squad, {
      removedMemberRole: leavingMember.role,
    });

    return res.status(200).json({
      ok: true,
      data: {
        squadId: squad.squadId,
        leftMemberId: leavingMember.memberId,
        newLeaderMemberId,
        remainingCount: squad.members.length,
        squadDeleted,
      },
    });
  } catch (error) {
    console.error("Error leaving squad:", error);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to leave squad" },
    });
  }
};

module.exports = {
  createSquadHandler,
  joinSquadHandler,
  getMySquadHandler,
  getSquadHandler,
  updateReadyStateHandler,
  startSearchHandler,
  cancelSearchHandler,
  kickMemberHandler,
  promoteMemberHandler,
  leaveSquadHandler,
};
