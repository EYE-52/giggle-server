# giggle-server

Backend service for Giggle MVP.

## Run

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

```bash
PORT=3001
MONGODB_URI=mongodb://localhost:27017/giggle
JWT_SECRET=replace-me

# Squad settings
MAX_SQUAD_MEMBERS=4
MIN_MEMBERS_TO_SEARCH=2

# Logging
ENABLE_REQUEST_LOGS=true
LOG_REQUEST_BODY=false
```

3. Start server

```bash
npm run dev
```

Swagger docs are served at `/api-docs`.

## Squad APIs (Phase 1)

- `POST /api/squads/create`
- `GET /api/squads/me`
- `POST /api/squads/join`
- `GET /api/squads/:squadId`
- `POST /api/squads/:squadId/ready`
- `POST /api/squads/:squadId/search` (leader only)
- `POST /api/squads/:squadId/search/cancel` (leader only)
- `POST /api/squads/:squadId/members/:memberId/kick` (leader only)
- `POST /api/squads/:squadId/members/:memberId/promote` (leader only)
- `POST /api/squads/:squadId/leave`

## Access Control Rules

- All squad endpoints require bearer JWT.
- User identity is resolved from JWT (`userId` primary).
- Squad member and leader checks are enforced through dedicated middleware.
- Leader-only actions return `403 LEADER_ONLY` for non-leaders.
- User cannot be in multiple squads simultaneously.

## Auto-Deletion Behavior

- When a member leaves and squad becomes empty, squad is automatically deleted.
