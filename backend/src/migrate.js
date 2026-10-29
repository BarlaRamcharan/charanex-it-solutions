const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./config');
const { createDatabase } = require('./database');

const MIGRATION_LOCK_ID = BigInt('0x43484152414e4558').toString();
const DEFAULT_MIGRATIONS_DIRECTORY = path.join(__dirname, '..', 'migrations', 'postgres');

async function migrate(pool, migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY) {
    const client = await pool.connect();
    let lockAcquired = false;
    try {
        await client.query('SELECT pg_advisory_lock($1::bigint)', [MIGRATION_LOCK_ID]);
        lockAcquired = true;
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const files = fs.readdirSync(migrationsDirectory)
            .filter(file => /^\d+_.+\.sql$/.test(file))
            .sort();
        for (const file of files) {
            const existing = await client.query(
                'SELECT 1 FROM schema_migrations WHERE name = $1',
                [file]
            );
            if (existing.rowCount) continue;

            const sql = fs.readFileSync(path.join(migrationsDirectory, file), 'utf8');
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query(
                    'INSERT INTO schema_migrations (name) VALUES ($1)',
                    [file]
                );
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
        }
        await client.query('DELETE FROM admin_sessions WHERE expire <= CURRENT_TIMESTAMP');
    } finally {
        try {
            if (lockAcquired) {
                await client.query('SELECT pg_advisory_unlock($1::bigint)', [MIGRATION_LOCK_ID]);
            }
        } finally {
            client.release();
        }
    }
}

if (require.main === module) {
    let pool;
    (async () => {
        try {
            const config = loadConfig();
            pool = createDatabase(config);
            await migrate(pool);
            console.log('PostgreSQL database migrations completed.');
        } catch (error) {
            console.error('Database migration failed:', error.message);
            process.exitCode = 1;
        } finally {
            if (pool) await pool.end();
        }
    })();
}

module.exports = { migrate };
