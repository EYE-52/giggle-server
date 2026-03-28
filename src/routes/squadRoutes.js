const express = require("express");
const { createSquadHandler, joinSquadHandler, getSquadHandler, updateReadyStateHandler, leaveSquadHandler } = require("../controllers/squadController");
const { requireApiAuth, attachGiggleIdentity, requireSquadMember } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Squads
 *   description: Squad lobby management
 */

/**
 * @swagger
 * /squads/create:
 *   post:
 *     summary: Create a new squad and assign requester as leader
 *     tags: [Squads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 description: Optional display name for the leader
 *     responses:
 *       201:
 *         description: Squad created
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal error
 */
router.post("/squads/create", requireApiAuth, attachGiggleIdentity, createSquadHandler);

/**
 * @swagger
 * /squads/join:
 *   post:
 *     summary: Join an existing squad by code
 *     tags: [Squads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               squadCode:
 *                 type: string
 *               displayName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Joined squad
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Squad not found
 *       409:
 *         description: Squad full or closed
 */
router.post("/squads/join", requireApiAuth, attachGiggleIdentity, joinSquadHandler);

/**
 * @swagger
 * /squads/{squadId}:
 *   get:
 *     summary: Get squad lobby state
 *     tags: [Squads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: squadId
 *         schema:
 *           type: string
 *         required: true
 *         description: Squad ID
 *     responses:
 *       200:
 *         description: Squad state
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Squad not found
 */
router.get("/squads/:squadId", requireApiAuth, attachGiggleIdentity, requireSquadMember, getSquadHandler);

/**
 * @swagger
 * /squads/{squadId}/leave:
 *   post:
 *     summary: Leave a squad (member or leader)
 *     tags: [Squads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: squadId
 *         schema:
 *           type: string
 *         required: true
 *         description: Squad ID
 *     responses:
 *       200:
 *         description: Left squad
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Squad or member not found
 */
router.post("/squads/:squadId/leave", requireApiAuth, attachGiggleIdentity, requireSquadMember, leaveSquadHandler);

module.exports = router;
