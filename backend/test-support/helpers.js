const bcrypt = require('bcryptjs');
const { createApp } = require('../src/app');
const { openDatabase } = require('../src/database');
const { migrate } = require('../src/migrate');

async function createTestContext() {
    const database = openDatabase(':memory:');
    migrate(database);
    const password = 'Test-only-password-123!';
    database.prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)')
        .run('admin@example.test', await bcrypt.hash(password, 4));
    const app = createApp({
        database,
        config: {
            production: false,
            sessionSecret: 'test-session-secret-with-more-than-32-characters',
            frontendOrigin: 'http://127.0.0.1:5500',
            smtp: null
        },
        logger: { error() {} }
    });
    return { app, database, password };
}

module.exports = { createTestContext };
