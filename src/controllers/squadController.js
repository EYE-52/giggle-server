const { Squad } = require("../models/Squad");
const { generateId, generateSquadCode } = require("../utils/idGenerator");

const createSquadHandler = async (req, res) => {
  const { displayName } = req.body;
  const { userId, providerAccountId, name, email, image } = req.giggleIdentity;

  if (!userId || !providerAccountId) {
    return res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  try {
    const squadId = generateId("sq");
    const squadCode = generateSquadCode();
    const memberId = generateId("mem");

    const newMember = {
      memberId,
      userId,
      providerAccountId,
      displayName: displayName || name || email, // Use provided, then auth name, then email
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

    res.status(201).json({
      ok: true,
      data: {
        squadId: newSquad.squadId,
        squadCode: newSquad.squadCode,
        member: newMember,
        status: newSquad.status,
      },
    });
  } catch (error) {
    console.error("Error creating squad:", error);
    res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to create squad" },
    });
  }
};

const joinSquadHandler = async (req, res) => {
  const { squadCode, displayName } = req.body;
  const { userId, providerAccountId, name, email } = req.giggleIdentity;

  if (!userId || !providerAccountId) {
    return res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  if (!squadCode) {
    return res.status(400).json({
      ok: false,
      error: { code: "INVALID_REQUEST", message: "Squad code is required" },
    });
  }

  try {
    let squad = await Squad.findOne({ squadCode });

    if (!squad) {
      return res.status(404).json({
        ok: false,
        error: { code: "SQUAD_NOT_FOUND", message: "Squad not found" },
      });
    }

    // Check if the user is already a member
    const existingMember = squad.members.find(
      (member) => member.providerAccountId === providerAccountId
    );
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

    // Prevent joining if squad is full or in an active state
    if (squad.members.length >= 4) { // Assuming a max of 4 members per squad
      return res.status(409).json({
        ok: false,
        error: { code: "SQUAD_FULL", message: "Squad is full" },
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

    res.status(200).json({
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
    res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to join squad" },
    });
  }
};

const getSquadHandler = async (req, res) => {
  const { squadId } = req.params;
  const { userId, providerAccountId } = req.giggleIdentity;

  if (!userId || !providerAccountId) {
    return res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  try {
    const squad = await Squad.findOne({ squadId });

    if (!squad) {
      return res.status(404).json({
        ok: false,
        error: { code: "SQUAD_NOT_FOUND", message: "Squad not found" },
      });
    }

    // Ensure the requesting user is a member of the squad
    const isMember = squad.members.some(
      (member) => member.providerAccountId === providerAccountId
    );
    if (!isMember) {
      return res.status(403).json({
        ok: false,
        error: { code: "FORBIDDEN", message: "Not a member of this squad" },
      });
    }

    const leader = squad.members.find(member => member.role === "leader");

    res.status(200).json({
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
    res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to retrieve squad state" },
    });
  }
};

const updateReadyStateHandler = async (req, res) => {
  const { squadId } = req.params;
  const { ready } = req.body;
  const { userId, providerAccountId } = req.giggleIdentity;

  if (!userId || !providerAccountId) {
    return res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  if (typeof ready !== "boolean") {
    return res.status(400).json({
      ok: false,
      error: { code: "INVALID_REQUEST", message: "Ready state must be a boolean" },
    });
  }

  try {
    const squad = await Squad.findOne({ squadId });

    if (!squad) {
      return res.status(404).json({
        ok: false,
        error: { code: "SQUAD_NOT_FOUND", message: "Squad not found" },
      });
    }

    const memberIndex = squad.members.findIndex(
      (member) => member.providerAccountId === providerAccountId
    );

    if (memberIndex === -1) {
      return res.status(404).json({
        ok: false,
        error: { code: "MEMBER_NOT_FOUND", message: "Member not found in squad" },
      });
    }

    // Prevent ready state changes if squad is not idle (e.g., in encounter)
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

    const readyCount = squad.members.filter((member) => member.ready).length;

    res.status(200).json({
      ok: true,
      data: {
        squadId: squad.squadId,
        memberId: squad.members[memberIndex].memberId,
        providerAccountId: squad.members[memberIndex].providerAccountId,
        ready: squad.members[memberIndex].ready,
        readyCount,
        totalMembers: squad.members.length,
      },
    });
  } catch (error) {
    console.error("Error updating ready state:", error);
    res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update ready state" },
    });
  }
};

// Leave Squad Handler
const leaveSquadHandler = async (req, res) => {
  const { squadId } = req.params;
  const { userId, providerAccountId } = req.giggleIdentity;

  if (!userId || !providerAccountId) {
    return res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  try {
    const squad = await Squad.findOne({ squadId });
    if (!squad) {
      return res.status(404).json({
        ok: false,
        error: { code: "SQUAD_NOT_FOUND", message: "Squad not found" },
      });
    }

    const memberIndex = squad.members.findIndex(
      (member) => member.providerAccountId === providerAccountId
    );
    if (memberIndex === -1) {
      return res.status(404).json({
        ok: false,
        error: { code: "MEMBER_NOT_FOUND", message: "Member not found in squad" },
      });
    }

    const leavingMember = squad.members[memberIndex];
    const wasLeader = leavingMember.role === "leader";
    squad.members.splice(memberIndex, 1);

    let newLeaderMemberId = null;
    let squadDeleted = false;

    if (squad.members.length === 0) {
      // Delete squad if no members left
      await squad.deleteOne();
      squadDeleted = true;
    } else {
      // If leader left, promote next member
      if (wasLeader) {
        squad.members[0].role = "leader";
        newLeaderMemberId = squad.members[0].memberId;
      } else {
        const leader = squad.members.find(m => m.role === "leader");
        newLeaderMemberId = leader ? leader.memberId : null;
      }
      await squad.save();
    }

    res.status(200).json({
      ok: true,
      data: {
        squadId,
        leftMemberId: leavingMember.memberId,
        newLeaderMemberId,
        remainingCount: squad.members.length,
        squadDeleted,
      },
    });
  } catch (error) {
    console.error("Error leaving squad:", error);
    res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to leave squad" },
    });
  }
};

module.exports = { createSquadHandler, joinSquadHandler, getSquadHandler, updateReadyStateHandler, leaveSquadHandler };
