# CharanEx backend setup

The existing GitHub Pages site remains a static frontend. The separate Express
service in `backend/` provides the database-backed contact, careers, and admin
features. No credentials belong in the frontend.

## Local setup

Requirements: Node.js 20+. SQLite is included and initialized by the backend.

1. In `backend/`, copy `.env.example` to `.env` and set `SESSION_SECRET` (at
   least 32 random characters) and `FRONTEND_ORIGIN`. `SQLITE_PATH` defaults
   to `data/charanex.sqlite`, relative to `backend/`. Keep `.env` private; it
   is ignored by Git.
2. Install backend dependencies with `npm install`.
3. Apply schema migrations with `node --env-file=.env src/migrate.js`.
   Startup also applies pending migrations before the server accepts requests.
4. Create an administrator interactively with `node --env-file=.env src/create-admin.js`. The
   password is hashed before it is saved; there is no default admin account.
5. Start the API with `npm run dev`. The service binds to `0.0.0.0` and uses
   `PORT`, defaulting to `3000`.

Optional SMTP notifications are disabled unless all SMTP and notification
variables in `.env.example` are configured. The database remains the source of
truth for submissions if notifications are not configured.

## Deployment outline

Recommended low-complexity setup: keep GitHub Pages for the static frontend
and host the existing Node service on a provider that supports persistent
mounted disks. SQLite requires the database file to remain on that disk across
deploys and restarts. Do not use the service's ephemeral filesystem, run
multiple backend instances against a local SQLite file, or share it over a
network filesystem. No provider resources are created by this repository.
Check the provider's current disk pricing, backup, region, and retention
options before provisioning anything.

### Create the backend service

Create a Node web service from the existing GitHub repository and attach a
persistent disk mounted at `/var/data`. Configure the web service:

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Runtime | Node |
| Build command | `npm ci` |
| Start command | `npm start` |
| Health-check path | `/api/health` |

Set these service environment variables in the provider dashboard:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `SQLITE_PATH` | `/var/data/charanex.sqlite` |
| `SESSION_SECRET` | New random secret of at least 32 characters |
| `FRONTEND_ORIGIN` | `https://barlaramcharan.github.io` |
| `PORT` | Leave unset; the provider supplies it |

The service reads the assigned `PORT`, binds to `0.0.0.0`, creates the parent
directory, and exposes a health endpoint that checks database connectivity.
Startup applies ordered SQLite migrations transactionally; migrations are
tracked in `schema_migrations`. Do not manually recreate tables or mark
migrations applied by hand. Back up `charanex.sqlite` and its associated
`-wal`/`-shm` files consistently (prefer a SQLite backup/checkpoint procedure)
before making changes to an existing production database.

The previous backend used PostgreSQL, but no PostgreSQL connection string or
database file is present in this repository. SQLite migrations do not import a
PostgreSQL database. If the existing service has any live records, do not switch
traffic until a separate export/import has been tested against a backup and
verified for enquiries, jobs, applications, administrators, sessions, and
resume BLOBs.
The new backend refuses to start if a legacy `DATABASE_URL` remains configured;
remove that variable only after the existing data has been accounted for.

After the backend is healthy, create the initial administrator from the
provider's service shell with `npm run admin:create`. The script prompts for
credentials and stores only a password hash. Do not put admin credentials in
the repository or frontend.

### Connect and verify GitHub Pages

After the backend has a stable public HTTPS URL, update the public,
non-secret `charanex-api-base` meta value in `index.html` from empty to that
origin, for example `https://<backend-host>`, and publish the existing Pages
frontend using the repository's existing deployment settings. Do not add a
trailing slash. The exact URL cannot be set before the provider assigns it.

Verify after deployment:

1. `GET https://<backend-host>/api/health` returns HTTP 200 and
   `{"status":"ok"}`. This checks database connectivity, not record retention.
2. Load the existing Pages URL and confirm public jobs load. Submit one
   controlled contact enquiry and one test application only after publishing
   a temporary test job in `/admin`.
3. Confirm an unapproved origin is rejected, unauthenticated admin API calls
   return 401, and an authenticated administrator can access the test records
   and download the test resume.
4. Restart/redeploy the backend, then confirm the test records and job remain
   available. This step verifies actual disk persistence.
5. Remove test records/job and resume after verification, if no longer needed.

The admin UI is served by the backend at `https://<backend-host>/admin`, so
admin session cookies remain same-origin. Public Pages submissions use the
backend's exact-origin CORS allowlist and do not send admin cookies. Resume
downloads remain private behind backend authorization; never upload resumes to
public object storage or expose database credentials in frontend files.

The Pages URL remains `https://barlaramcharan.github.io/charanex-it-solutions/`.
No deployment has been run or verified yet.

Resumes are validated and stored as private SQLite BLOB data, then
available only through authenticated admin downloads. Back up the database
regularly; do not expose database credentials or resume data in browser code.
No hosting resources are provisioned by this repository. A persistent disk and
always-on web service may incur cost. Production persistence has not been
verified until records and resume downloads are confirmed after a real
host-level restart/redeploy.
