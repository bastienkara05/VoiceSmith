# VoiceSmith

> AI voice line studio for game developers — generate, organize, and export character voices for Unity, Unreal, and Godot.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Auth0](https://img.shields.io/badge/Auth-Auth0-EB5424?logo=auth0&logoColor=white)
![ElevenLabs](https://img.shields.io/badge/AI-ElevenLabs-000000)
![License](https://img.shields.io/badge/license-MIT-green)

VoiceSmith turns a script into a folder of game-ready voice files. Writers and indie devs paste dialogue, pick a character preset, hit generate, and walk away with named `.mp3` clips plus a manifest their game engine can read directly.

---

## Demo

> Screenshots / demo GIF coming soon. Drop your captures into `docs/screenshots/` and reference them here, for example:
>
> ![Dashboard](docs/screenshots/dashboard.png)
> ![Project workspace](docs/screenshots/project.png)
> ![Unity export](docs/screenshots/unity-export.png)

---

## What it does

- **Scene-based workflow.** Projects contain scenes; scenes contain ordered lines. Each line is tied to a character with a saved voice.
- **Character presets.** Five tuned voice archetypes (warrior, wizard, villain, narrator, medic) backed by ElevenLabs voice IDs. Per-line emotion control: neutral / intense / whisper / shout.
- **Batch generation.** Generate every line in a scene or project in one click, with progress tracking and per-line retry.
- **Engine-aware export.** Build a Unity `ScriptableObject` package, an Unreal `DataTable` CSV with `.uasset` references, or a Godot `.tres` resource pack — pick the engine and ship.
- **Quotas and plans.** Free / Indie / Studio tiers with monthly generation counts enforced server-side. Usage resets automatically on the first of each month.
- **Email verification & account flows.** Users must verify their email before generating; resend / pending states handled end-to-end.
- **Multi-tenant data model.** All reads/writes are scoped to the authenticated Auth0 user; project-level cascading deletes keep the schema clean.

---

## Tech stack

| Layer        | Choice                                  | Why                                                                                  |
|--------------|------------------------------------------|--------------------------------------------------------------------------------------|
| Frontend     | React 19 + Vite + CSS Modules            | Fast dev loop, scoped styles, zero-config routing via React Router.                  |
| Backend      | Node + Express                           | Lightweight REST API; easy to host on Railway / Render.                              |
| Database     | PostgreSQL (UUIDs, cascading FKs)        | Strong relational model for projects -> scenes -> lines -> characters.               |
| Auth         | Auth0 (SPA + API)                        | JWT bearer flow, hosted login, email verification out of the box.                    |
| Voice AI     | ElevenLabs Text-to-Speech                | Studio-grade voices with per-request emotion / stability tuning.                     |
| Email        | Resend                                   | Transactional verification emails.                                                   |
| Deployment   | Vercel (client) + Railway (server + DB)  | Both free-tier friendly, deploy on push.                                             |

---

## Architecture

```
+--------------------+        +----------------------+        +-----------------+
| React SPA (Vite)   | --JWT->| Express API          | --SQL->| PostgreSQL      |
| Auth0 SDK          |        | Auth0 JWT middleware |        | users, projects |
| CSS Modules        | <------| /api/voice           |        | scenes, lines   |
+--------------------+        | /api/export          |        | characters      |
                              | /api/batch           |        +-----------------+
                              | /api/account         |
                              +-----------+----------+
                                          |
                          +---------------+---------------+
                          v                               v
                  +---------------+               +---------------+
                  | ElevenLabs    |               | Resend (mail) |
                  | TTS API       |               |               |
                  +---------------+               +---------------+
```

Auth flow: SPA gets an access token from Auth0 -> sends it as `Authorization: Bearer ...` on every API call -> Express middleware validates the JWT against Auth0's JWKS and attaches `req.user` before any route handler runs.

---

## Project structure

```
voicesmith/
├── client/                          # React + Vite frontend
│   ├── src/
│   │   ├── pages/                   # Landing, Dashboard, Project, Settings, Callback, VerifyEmail
│   │   ├── components/
│   │   │   ├── BatchGenerator.jsx   # Bulk line generation with progress
│   │   │   ├── UnityExport.jsx      # Engine-specific export dialogs
│   │   │   ├── UnrealExport.jsx
│   │   │   ├── GodotExport.jsx
│   │   │   ├── VoiceAssignment.jsx  # Character → preset mapping
│   │   │   ├── OnboardingTutorial.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── ImportDialog.jsx     # Bulk-import lines from text
│   │   │   ├── layout/AppShell.jsx
│   │   │   └── ui/                  # Button, Modal, Toast
│   │   ├── hooks/                   # useApi (Auth0 axios), useToast, useOnboarding
│   │   └── App.jsx
│   └── vite.config.js
│
├── server/                          # Express API
│   ├── routes/
│   │   ├── projects.js              # CRUD
│   │   ├── scenes.js                # CRUD with ordering
│   │   ├── voice.js                 # Generation, characters, lines, quota enforcement
│   │   ├── batch.js                 # Whole-scene / whole-project generation
│   │   ├── export.js                # Unity / Unreal / Godot manifests
│   │   ├── import.js                # Bulk line import
│   │   └── account.js               # Plan, usage, email verification
│   ├── middleware/auth.js           # Auth0 JWT validation
│   ├── lib/
│   │   ├── presets.js               # Voice preset definitions
│   │   └── email.js                 # Resend wrapper
│   ├── db/
│   │   ├── pool.js                  # pg connection pool
│   │   └── schema.sql               # Full schema with triggers
│   └── index.js
│
├── LICENSE
└── README.md
```

---

## API

| Method | Route                       | Description                                    |
|--------|-----------------------------|------------------------------------------------|
| GET    | /api/projects               | List the authenticated user's projects         |
| POST   | /api/projects               | Create project                                 |
| GET    | /api/projects/:id           | Get project with scenes + lines                |
| PATCH  | /api/projects/:id           | Update project                                 |
| DELETE | /api/projects/:id           | Delete project (cascades)                      |
| POST   | /api/scenes                 | Create scene                                   |
| PATCH  | /api/scenes/:id             | Update / reorder scene                         |
| DELETE | /api/scenes/:id             | Delete scene                                   |
| GET    | /api/voice/presets          | List available voice presets                   |
| GET    | /api/voice/usage            | Current month's generation usage + plan cap    |
| POST   | /api/voice/generate         | Generate a single voice line                   |
| POST   | /api/voice/characters       | Add a character to a project                   |
| POST   | /api/voice/lines            | Save a generated line                          |
| DELETE | /api/voice/lines/:id        | Delete a line                                  |
| POST   | /api/batch/scene/:id        | Generate every line in a scene                 |
| POST   | /api/batch/project/:id      | Generate every line in a project               |
| POST   | /api/import/scene/:id       | Bulk import lines from text                    |
| GET    | /api/export/scene/:id       | Engine-aware scene export                      |
| GET    | /api/export/project/:id     | Engine-aware project export                    |
| GET    | /api/account                | Current plan, quota, verification status       |
| POST   | /api/account/verify-email   | Trigger / confirm email verification           |

---

## Quick start

```bash
# 1. Install
npm install
cd client && npm install
cd ../server && npm install
cd ..

# 2. Configure env
cp server/.env.example server/.env   # then fill in Auth0, Postgres, ElevenLabs
cp client/.env.example client/.env   # then fill in Auth0 SPA values

# 3. Database
psql voicesmith < server/db/schema.sql

# 4. Run both client and server
npm run dev
```

Open **http://localhost:5173**.

### Required accounts
- [Auth0](https://auth0.com) — free SPA + API. Set callback `http://localhost:5173/dashboard`, logout `http://localhost:5173`, web origin `http://localhost:5173`.
- [ElevenLabs](https://elevenlabs.io) — free tier includes generation credits.
- Postgres — local install, or a free Railway / Supabase database.

---

## Deployment

- **Client:** Vercel — connect the repo, set the three `VITE_AUTH0_*` env vars, deploy.
- **Server + DB:** Railway — connect the repo, add a Postgres plugin, set the server `.env` vars, deploy.
- Update the `cors` origin in `server/index.js` to your production domain before going live.

---

## Roadmap

- Stripe billing for plan upgrades
- Unity Editor plugin (C# package) to drop generated voices straight into a project
- Claude-powered scene annotation (auto-pick emotion from script context)
- Voice consistency scoring across lines
- Multi-language support via ElevenLabs multilingual models

---

## License

MIT — see [LICENSE](LICENSE).
