const express = require("express");
const { exchangeAuth } = require("../controllers/authController");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication & user sync APIs
 */

/**
 * @swagger
 * /auth/exchange:
 *   post:
 *     summary: Exchange NextAuth session user for backend JWT
 *     description: |
 *       This endpoint is called after successful Google login via NextAuth.
 *       It syncs the user with backend DB (find-or-create) and returns a backend JWT.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@gmail.com
 *               name:
 *                 type: string
 *                 example: Himanshu
 *               image:
 *                 type: string
 *                 example: https://lh3.googleusercontent.com/a/photo.jpg
 *     responses:
 *       200:
 *         description: Successfully generated backend JWT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 65f1a2b3c4d5e6f7a8b9c0d1
 *                     email:
 *                       type: string
 *                       example: user@gmail.com
 *                     name:
 *                       type: string
 *                       example: Himanshu
 *                     image:
 *                       type: string
 *                       example: https://lh3.googleusercontent.com/a/photo.jpg
 *       400:
 *         description: Missing or invalid input
 *       500:
 *         description: Internal server error
 */
router.post("/exchange", exchangeAuth);

module.exports = router;