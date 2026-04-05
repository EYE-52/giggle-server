const express = require("express");
const {
	createSquadHandler,
	joinSquadHandler,
	getMySquadHandler,
	getSquadHandler,
	updateReadyStateHandler,
	updateSquadNameHandler,
	startSearchHandler,
	cancelSearchHandler,
	kickMemberHandler,
	promoteMemberHandler,
	leaveSquadHandler,
	updateLobbyVideoPresenceHandler,
} = require("../controllers/squadController");
const { requireApiAuth } = require("../middlewares/authMiddleware");
const {
	requireSquadMemberAccess,
	requireSquadLeaderAccess,
} = require("../middlewares/squadAccessMiddleware");

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
 *       409:
 *         description: User already belongs to another squad
 *       500:
 *         description: Internal error
 */
router.post("/squads/create", requireApiAuth, createSquadHandler);

/**
 * @swagger
 * /squads/me:
 *   get:
 *     summary: Get current user's squad context
 *     tags: [Squads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current squad context or inSquad false
 *       401:
 *         description: Unauthorized
 */
router.get("/squads/me", requireApiAuth, getMySquadHandler);

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
 *       400:
 *         description: Invalid payload or squad code format
 *       401:
 *         description: Unauthorized or token/user invalid
 *       404:
 *         description: Squad not found
 *       409:
 *         description: Squad full, closed, or user already in another squad
 */
router.post("/squads/join", requireApiAuth, joinSquadHandler);

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
router.get("/squads/:squadId", requireApiAuth, requireSquadMemberAccess, getSquadHandler);

/**
 * @swagger
 * /squads/{squadId}/ready:
 *   post:
 *     summary: Update ready state for authenticated member
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ready
 *             properties:
 *               ready:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Ready state updated
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Squad or member not found
 *       409:
 *         description: Invalid squad state
 */
router.post("/squads/:squadId/ready", requireApiAuth, requireSquadMemberAccess, updateReadyStateHandler);
router.post("/squads/:squadId/name", requireApiAuth, requireSquadLeaderAccess, updateSquadNameHandler);

/**
 * @swagger
 * /squads/{squadId}/search:
 *   post:
 *     summary: Start matchmaking search (leader only)
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
 *         description: Squad moved to searching state
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Leader only or not squad member
 *       404:
 *         description: Squad not found
 *       409:
 *         description: Invalid state, not enough members, or not all ready
 */
router.post("/squads/:squadId/search", requireApiAuth, requireSquadLeaderAccess, startSearchHandler);

/**
 * @swagger
 * /squads/{squadId}/search/cancel:
 *   post:
 *     summary: Cancel matchmaking search (leader only)
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
 *         description: Search canceled and squad moved to idle
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Leader only or not squad member
 *       404:
 *         description: Squad not found
 *       409:
 *         description: Squad not currently searching
 */
router.post("/squads/:squadId/search/cancel", requireApiAuth, requireSquadLeaderAccess, cancelSearchHandler);

/**
 * @swagger
 * /squads/{squadId}/members/{memberId}/kick:
 *   post:
 *     summary: Kick a member from squad (leader only)
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
 *       - in: path
 *         name: memberId
 *         schema:
 *           type: string
 *         required: true
 *         description: Member ID to remove
 *     responses:
 *       200:
 *         description: Member removed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Leader only or not squad member
 *       404:
 *         description: Squad or target member not found
 *       409:
 *         description: Leader cannot be kicked
 */
router.post("/squads/:squadId/members/:memberId/kick", requireApiAuth, requireSquadLeaderAccess, kickMemberHandler);

/**
 * @swagger
 * /squads/{squadId}/members/{memberId}/promote:
 *   post:
 *     summary: Promote a member to leader (leader only)
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
 *       - in: path
 *         name: memberId
 *         schema:
 *           type: string
 *         required: true
 *         description: Member ID to promote
 *     responses:
 *       200:
 *         description: Leadership transferred
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Leader only or not squad member
 *       404:
 *         description: Squad or target member not found
 *       409:
 *         description: Target already leader
 */
router.post("/squads/:squadId/members/:memberId/promote", requireApiAuth, requireSquadLeaderAccess, promoteMemberHandler);

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
router.post("/squads/:squadId/leave", requireApiAuth, requireSquadMemberAccess, leaveSquadHandler);
router.post("/squads/:squadId/lobby-video", requireApiAuth, requireSquadMemberAccess, updateLobbyVideoPresenceHandler);

module.exports = router;
