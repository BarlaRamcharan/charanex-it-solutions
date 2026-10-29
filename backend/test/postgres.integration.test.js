const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config');
const { createDatabase } = require('../src/database');
const { migrate } = require('../src/migrate');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('real PostgreSQL migration, health, write, and cross-pool persistence', {
    skip: !testDatabaseUrl
}, async () => {
    const databaseName = new URL(testDatabaseUrl).pathname.slice(1);
    if (!/test/i.test(databaseName)) {
        throw new Error('TEST_DATABASE_URL must point to a dedicated database with "test" in its name.');
    }

    const config = loadConfig({
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: testDatabaseUrl,
        SESSION_SECRET: 'postgres-integration-test-session-secret',
        FRONTEND_ORIGIN: 'http://127.0.0.1:5500'
    });
    const database = createDatabase(config);
    const verificationPool = createDatabase(config);
    const submissionMarker = `integration-${Date.now()}@example.test`;
    let migrationsReady = false;
    try {
        await migrate(database);
        migrationsReady = true;
        const app = createApp({ database, config, logger: { error() {} } });
        const health = await request(app).get('/api/health');
        assert.equal(health.status, 200);
        assert.deepEqual(health.body, { status: 'ok' });

        const response = await request(app).post('/api/contact').send({
            name: 'PostgreSQL Integration',
            email: submissionMarker,
            subject: 'Integration test',
            serviceOfInterest: 'General enquiry',
            message: 'Temporary integration record.'
        });
        assert.equal(response.status, 201);
        const { rows } = await verificationPool.query(
            'SELECT email FROM enquiries WHERE email = $1',
            [submissionMarker]
        );
        assert.equal(rows.length, 1);
    } finally {
        if (migrationsReady) {
            await verificationPool.query('DELETE FROM enquiries WHERE email = $1', [submissionMarker]);
        }
        await verificationPool.end();
        await database.end();
    }
});
