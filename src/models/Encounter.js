const mongoose = require("mongoose");

const encounterSchema = new mongoose.Schema({
  encounterId: { type: String, required: true, unique: true },
  squadAId: { type: String, required: true },
  squadBId: { type: String, required: true },
  status: {
    type: String,
    enum: ["awaiting_ack", "active", "ended"],
    default: "awaiting_ack",
  },
  ackBySquad: {
    type: Map,
    of: Boolean,
    default: {},
  },
  matchedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
});

const Encounter = mongoose.model("Encounter", encounterSchema);

module.exports = { Encounter };
