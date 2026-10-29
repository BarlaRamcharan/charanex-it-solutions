const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config');
const { prepareDatabase } = require('../src/server');

test('PostgreSQL startup checks connectivity before and after applying migrations', async () => {
    const config = loadConfig({
        DATABASE_URL: 'postgres://charanex:local-password@localhost:5432/charanex',
        SESSION_SECRET: 'test-session-secret-with-more-than-32-characters',
        NODE_ENV: 'production'
    });
    const startupSequence = [];
    const database = {
        async query(sql) {
            startupSequence.push(sql);
            return { rows: [{ '?column?': 1 }] };
        }
    };
    const migrationRunner = async pool => {
        assert.equal(pool, database);
        startupSequence.push('MIGRATIONS');
    };

    assert.match(config.databaseUrl, /^postgres:/);
    await prepareDatabase(database, migrationRunner);
    assert.deepEqual(startupSequence, ['SELECT 1', 'MIGRATIONS', 'SELECT 1']);
});

test('PostgreSQL startup does not continue to migrations if the database is unavailable', async () => {
    const startupSequence = [];
    const database = {
        async query() {
            startupSequence.push('SELECT 1');
            throw new Error('database connection unavailable');
        }
    };
    const migrationRunner = async () => startupSequence.push('MIGRATIONS');

    await assert.rejects(
        prepareDatabase(database, migrationRunner),
        /database connection unavailable/
    );
    assert.deepEqual(startupSequence, ['SELECT 1']);
});
