const mongoose = require("mongoose");

const squadMemberSchema = new mongoose.Schema({
  memberId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  providerAccountId: { type: String, required: true },
  displayName: { type: String },
  role: { type: String, enum: ["leader", "member"], default: "member" },
  ready: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now },
});

const squadSchema = new mongoose.Schema({
  squadId: { type: String, required: true, unique: true },
  squadCode: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ["idle", "searching", "matched", "in_encounter"],
    default: "idle",
  },
  members: [squadMemberSchema],
  createdAt: { type: Date, default: Date.now },
});

const Squad = mongoose.model("Squad", squadSchema);
const SquadMember = mongoose.model("SquadMember", squadMemberSchema);

module.exports = { Squad, SquadMember };
