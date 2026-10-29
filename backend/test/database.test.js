const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../src/database');
const { PostgresSessionStore } = require('../src/session-store');
const { createTestContext } = require('../test-support/helpers');

test('database pool uses the configured PostgreSQL URL and verified TLS policy', () => {
    class PoolProbe {
        constructor(options) {
            this.options = options;
        }
    }

    const config = {
        databaseUrl: 'postgres://charanex:local-password@localhost:5432/charanex',
        databaseSsl: true
    };
    const pool = createDatabase(config, PoolProbe);
    assert.equal(pool.options.connectionString, config.databaseUrl);
    assert.deepEqual(pool.options.ssl, { rejectUnauthorized: true });
    assert.equal(pool.options.max, 5);
    assert.equal(pool.options.connectionTimeoutMillis, 10_000);
});

test('PostgreSQL session storage persists sessions across store instances and expires them', async t => {
    const { database, createPool } = await createTestContext();
    const secondPool = createPool();
    t.after(async () => {
        await secondPool.end();
        await database.end();
    });

    const store = new PostgresSessionStore(database);
    const sessionId = 'test-session-id';
    const value = {
        adminId: 7,
        cookie: { expires: new Date(Date.now() + 60_000).toISOString() }
    };
    await new Promise((resolve, reject) => {
        store.set(sessionId, value, error => error ? reject(error) : resolve());
    });

    const reopenedStore = new PostgresSessionStore(secondPool);
    const restored = await new Promise((resolve, reject) => {
        reopenedStore.get(sessionId, (error, item) => error ? reject(error) : resolve(item));
    });
    assert.equal(restored.adminId, 7);
    await new Promise((resolve, reject) => {
        reopenedStore.touch(sessionId, {
            cookie: { expires: new Date(Date.now() - 1_000).toISOString() }
        }, error => error ? reject(error) : resolve());
    });
    const expired = await new Promise((resolve, reject) => {
        store.get(sessionId, (error, item) => error ? reject(error) : resolve(item));
    });
    assert.equal(expired, null);
});
