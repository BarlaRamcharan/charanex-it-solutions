# CharanEx backend setup

The GitHub Pages site remains the static frontend. The separate Express service
in `backend/` provides database-backed contact, careers, and admin features. No
database credentials belong in the frontend.

## Local development

Requirements: Node.js 20+ and a PostgreSQL server.

1. In `backend/`, copy `.env.example` to `.env`. Set `DATABASE_URL` to a
   PostgreSQL connection URL, keep `PGSSLMODE=disable` for a local database,
   set `SESSION_SECRET` to at least 32 random characters, and configure
   `FRONTEND_ORIGIN`. Keep `.env` private; Git ignores it.
2. Install dependencies with `npm install`.
3. Run `npm run migrate`. The server also applies pending PostgreSQL migrations
   before accepting requests.
4. Create an administrator with `npm run admin:create`. The interactive script
   hashes the password; no default admin account exists.
5. Start the API with `npm run dev`. The service binds to `0.0.0.0` and uses
   `PORT`, defaulting to `3000`.

The PostgreSQL schema and ordered migration ledger are in
`backend/migrations/postgres/`. The prior SQLite migrations remain available
only to read an existing SQLite database during a one-time import; the running
server never falls back to SQLite.

## Importing existing SQLite records

If the existing deployment has a SQLite database, preserve a backup and do not
switch traffic until its import has been verified. This import reads the source
database in read-only mode, does not delete or alter it, and imports admins,
enquiries, jobs, applications, live sessions, and private resume BLOBs in one
PostgreSQL transaction. It refuses to overwrite conflicting PostgreSQL records
and rolls the import back if a record cannot be preserved.

Run the import from a trusted machine that can reach the PostgreSQL database:

```text
cd backend
copy .env.example .env
```

Set `DATABASE_URL` in the local, ignored `.env` to the target database URL. For
an external TLS connection set `PGSSLMODE=require`. Then run:

```text
npm run import:sqlite -- "C:\path\to\backed-up-charanex.sqlite"
```

The SQLite import driver is a development dependency used only by this command.
Do not upload the SQLite file or resume files to a public location. Importing
will fail rather than merge or overwrite duplicate target IDs or records.
Review the printed row counts and verify imported records before directing
website traffic to the new backend. If there is no SQLite database to preserve,
skip the import.

## Tests

Run the default backend suite with:

```text
npm test
```

The API and session tests use `pg-mem` to exercise PostgreSQL-dialect queries
without requiring a running server. To also test against a real PostgreSQL
instance, create a dedicated disposable database whose name contains `test`,
then provide its connection string as `TEST_DATABASE_URL` and run:

```text
npm run test:postgres
```

That test applies migrations and creates then removes a temporary contact
record. Never point `TEST_DATABASE_URL` at a production or data-bearing
database. The real-PostgreSQL test is skipped when `TEST_DATABASE_URL` is unset;
an emulator pass alone is not proof that a managed PostgreSQL deployment is
reachable or persistent.

## Render deployment

Keep GitHub Pages for the existing static frontend and run the Express API as a
separate Render web service. Use Render's managed PostgreSQL service, not local
SQLite: Render's free web service filesystem is not persistent. Do not add a
disk mount or use `/var/data`. Check Render's current free-database availability,
capacity, backup, expiration, and retention limits before choosing it; do not
assume free-tier PostgreSQL is permanent or suitable for production data.

Configure the backend web service:

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Runtime | Node |
| Build command | `npm ci` |
| Start command | `npm start` |
| Health-check path | `/api/health` |

Create or select a PostgreSQL database and set the service's environment
variables in Render's dashboard:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Render's private/internal PostgreSQL connection URL |
| `PGSSLMODE` | `require` |
| `PGSSLROOTCERT` | `/etc/secrets/supabase-root-ca.crt` |
| `SESSION_SECRET` | New random secret of at least 32 characters |
| `FRONTEND_ORIGIN` | `https://barlaramcharan.github.io` |
| `PORT` | Leave unset; Render supplies it |

In the Supabase Dashboard, open **Database Settings → SSL Configuration** and
download the project's root certificate. In Render's service **Environment**
settings, add that PEM certificate as a **Secret File** named
`supabase-root-ca.crt`, then set `PGSSLROOTCERT` to
`/etc/secrets/supabase-root-ca.crt`. Do not paste the certificate into source
control, the frontend, or logs. The backend reads the file at startup and adds
it to Node's standard trusted roots for node-postgres with
`rejectUnauthorized: true`; Node also verifies that the server hostname
matches the certificate. Production startup fails clearly if the CA file is
absent or unreadable.

Never put connection URLs, passwords, session secrets, or admin credentials in
the repository, frontend, logs, or issue reports. `PGSSLMODE=require` encrypts
the connection; the explicit Supabase CA enables trust-chain verification while
certificate verification stays enabled. Production refuses `PGSSLMODE=disable`.
For local development, the example config keeps TLS disabled for a local
PostgreSQL instance.

The service applies pending PostgreSQL migrations and checks database
connectivity before it begins listening. `/api/health` returns
`{"status":"ok"}` only when the database query succeeds. This does not verify
data retention across a provider restart or database expiry.

After the backend is healthy, create the initial administrator from the
provider's service shell with `npm run admin:create`. The script prompts for
credentials and stores only a password hash. The existing admin UI is served
at `https://<backend-host>/admin`; authentication remains required.

## Connect and verify GitHub Pages

After the backend has a stable public HTTPS URL, set the public, non-secret
`charanex-api-base` meta value in `index.html` to that origin (without a
trailing slash), then publish the existing Pages frontend using its current
repository deployment settings. The Pages URL remains
`https://barlaramcharan.github.io/charanex-it-solutions/`.

Verify after deployment:

1. `GET https://<backend-host>/api/health` returns HTTP 200 and
   `{"status":"ok"}`.
2. Load the existing Pages URL and confirm public jobs load. Submit one
   controlled contact enquiry and one test application only after publishing a
   temporary test job in `/admin`.
3. Confirm an unapproved origin is rejected, unauthenticated admin API calls
   return 401, and an authenticated administrator can access the test records
   and download the test resume.
4. Restart/redeploy the backend and verify the records remain available. Also
   verify managed database retention against the provider's actual policy.
5. Remove test records, job, and resume after verification if no longer needed.

Public Pages submissions use the backend's exact-origin CORS allowlist and do
not send admin cookies. Admin session cookies remain same-origin. Resume data is
stored in private PostgreSQL `BYTEA` columns and is downloadable only through
authorized admin endpoints; it is never exposed in public listings.

No hosting resources have been provisioned and no deployment has been run or
verified. Production connectivity and persistence remain to be tested after
the service and managed database are configured.
