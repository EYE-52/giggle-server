const { Squad } = require("../models/Squad");
const { Encounter } = require("../models/Encounter");
const { generateId } = require("../utils/idGenerator");

const ENCOUNTER_ACK_TIMEOUT_MS = 30 * 1000;

const toDate = (value) => (value ? new Date(value) : null);

const getSquadSize = (squad) => (Array.isArray(squad.members) ? squad.members.length : 0);

const scoreCandidate = ({ seeker, candidate, now }) => {
  const sizePenalty = Math.abs(getSquadSize(seeker) - getSquadSize(candidate)) * 40;
  const seekerQueuedAt = toDate(seeker.searchQueuedAt) || now;
  const candidateQueuedAt = toDate(candidate.searchQueuedAt) || now;
  const waitSeconds = Math.max(
    0,
    Math.floor((now.getTime() - Math.min(seekerQueuedAt.getTime(), candidateQueuedAt.getTime())) / 1000)
  );
  const waitBonus = -Math.min(waitSeconds, 60);

  return sizePenalty + waitBonus;
};

const pickBestCandidate = (seeker, candidates) => {
  const now = new Date();
  let best = null;

  for (const candidate of candidates) {
    const score = scoreCandidate({ seeker, candidate, now });
    if (!best || score < best.score) {
      best = { candidate, score };
    }
  }

  return best ? best.candidate : null;
};

const createEncounterForSquads = async (squadA, squadB) => {
  const encounterId = generateId("enc");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ENCOUNTER_ACK_TIMEOUT_MS);

  const encounter = await Encounter.create({
    encounterId,
    squadAId: squadA.squadId,
    squadBId: squadB.squadId,
    status: "awaiting_ack",
    ackBySquad: {
      [squadA.squadId]: false,
      [squadB.squadId]: false,
    },
    matchedAt: now,
    expiresAt,
  });

  squadA.status = "matched";
  squadA.currentEncounterId = encounterId;
  squadA.opponentSquadId = squadB.squadId;
  squadA.matchedAt = now;
  squadA.searchQueuedAt = null;

  squadB.status = "matched";
  squadB.currentEncounterId = encounterId;
  squadB.opponentSquadId = squadA.squadId;
  squadB.matchedAt = now;
  squadB.searchQueuedAt = null;

  await Promise.all([squadA.save(), squadB.save()]);

  return encounter;
};

const tryMatchmakeForSquad = async (squad) => {
  if (!squad || squad.status !== "searching") {
    return null;
  }

  const candidates = await Squad.find({
    status: "searching",
    squadId: { $ne: squad.squadId },
  });

  if (!candidates.length) {
    return null;
  }

  const bestCandidate = pickBestCandidate(squad, candidates);
  if (!bestCandidate) {
    return null;
  }

  const freshSquad = await Squad.findOne({ squadId: squad.squadId });
  const freshCandidate = await Squad.findOne({ squadId: bestCandidate.squadId });

  if (!freshSquad || !freshCandidate) {
    return null;
  }

  if (freshSquad.status !== "searching" || freshCandidate.status !== "searching") {
    return null;
  }

  return createEncounterForSquads(freshSquad, freshCandidate);
};

const getMatchmakingStatus = async (squadId) => {
  const squad = await Squad.findOne({ squadId });
  if (!squad) {
    return null;
  }

  let match = null;
  if (squad.currentEncounterId) {
    const encounter = await Encounter.findOne({ encounterId: squad.currentEncounterId });
    if (encounter) {
      const opponentSquadId = encounter.squadAId === squadId ? encounter.squadBId : encounter.squadAId;
      const opponentSquad = await Squad.findOne({ squadId: opponentSquadId });
      match = {
        encounterId: encounter.encounterId,
        opponentSquadId,
        ownSquadName: squad.squadName,
        opponentSquadName: opponentSquad?.squadName || "Unknown squad",
        matchedAt: encounter.matchedAt,
        status: encounter.status,
      };
    }
  }

  return {
    squad,
    queue:
      squad.status === "searching"
        ? {
            region: squad.searchRegion || "global",
            size: getSquadSize(squad),
            queuedAt: squad.searchQueuedAt,
            waitSeconds: squad.searchQueuedAt
              ? Math.max(0, Math.floor((Date.now() - new Date(squad.searchQueuedAt).getTime()) / 1000))
              : 0,
          }
        : null,
    match,
  };
};

const getEncounterById = async (encounterId) => {
  return Encounter.findOne({ encounterId });
};

const ackEncounterForSquad = async ({ encounter, squadId }) => {
  if (!encounter) {
    return { error: { status: 404, code: "ENCOUNTER_NOT_FOUND", message: "Encounter not found" } };
  }

  if (encounter.status === "ended") {
    return { error: { status: 409, code: "ENCOUNTER_ENDED", message: "Encounter is no longer active" } };
  }

  if (new Date(encounter.expiresAt).getTime() < Date.now()) {
    encounter.status = "ended";
    encounter.endedAt = new Date();
    await encounter.save();
    return { error: { status: 409, code: "ENCOUNTER_EXPIRED", message: "Encounter handoff expired" } };
  }

  if (![encounter.squadAId, encounter.squadBId].includes(squadId)) {
    return { error: { status: 403, code: "FORBIDDEN", message: "Squad is not part of this encounter" } };
  }

  encounter.ackBySquad.set(squadId, true);

  const allAcked = Boolean(encounter.ackBySquad.get(encounter.squadAId)) && Boolean(encounter.ackBySquad.get(encounter.squadBId));

  if (allAcked) {
    encounter.status = "active";

    await Squad.updateMany(
      { squadId: { $in: [encounter.squadAId, encounter.squadBId] } },
      {
        $set: {
          status: "in_encounter",
        },
      }
    );
  }

  await encounter.save();

  return {
    acknowledged: true,
    allAcked,
    encounter,
  };
};

const endEncounterAndRequeue = async ({ encounter, triggeringSquadId }) => {
  const squadIds = [encounter.squadAId, encounter.squadBId];
  encounter.status = "ended";
  encounter.endedAt = new Date();
  await encounter.save();

  // Clear encounter state and set both squads to searching with no encounter
  const now = new Date();
  await Squad.updateMany(
    { squadId: { $in: squadIds } },
    {
      $set: {
        status: "searching",
        currentEncounterId: null,
        opponentSquadId: null,
        matchedAt: null,
        searchQueuedAt: now,
        "members.$[].inEncounterVideo": false,
      },
    }
  );

  const triggeringSquad = await Squad.findOne({ squadId: triggeringSquadId });
  if (!triggeringSquad) {
    return null;
  }

  await tryMatchmakeForSquad(triggeringSquad);

  return triggeringSquad;
};

const endEncounterToIdle = async ({ encounter }) => {
  const squadIds = [encounter.squadAId, encounter.squadBId];

  encounter.status = "ended";
  encounter.endedAt = new Date();
  await encounter.save();

  // Clear encounter state and inEncounterVideo flags for all members
  await Squad.updateMany(
    { squadId: { $in: squadIds } },
    {
      $set: {
        status: "idle",
        currentEncounterId: null,
        opponentSquadId: null,
        matchedAt: null,
        searchQueuedAt: null,
        "members.$[].inEncounterVideo": false,
      },
    }
  );
};

module.exports = {
  tryMatchmakeForSquad,
  getMatchmakingStatus,
  getEncounterById,
  ackEncounterForSquad,
  endEncounterAndRequeue,
  endEncounterToIdle,
};
