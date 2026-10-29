const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { newDb } = require('pg-mem');
const { createApp } = require('../src/app');

function createMemoryDatabase() {
    const memoryDatabase = newDb();
    const { DataType } = require('pg-mem');
    const sequenceResets = [];
    memoryDatabase.public.registerFunction({
        name: 'pg_get_serial_sequence',
        args: [DataType.text, DataType.text],
        returns: DataType.text,
        implementation: (tableName, columnName) => `${tableName}_${columnName}_seq`
    });
    memoryDatabase.public.registerFunction({
        name: 'setval',
        args: [DataType.text, DataType.integer, DataType.bool],
        returns: DataType.integer,
        implementation: (sequenceName, sequenceValue, called) => {
            sequenceResets.push({ sequenceName, sequenceValue, called });
            return sequenceValue;
        }
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    return {
        memoryDatabase,
        sequenceResets,
        database: new Pool(),
        createPool: () => new Pool()
    };
}

async function preparePostgresDatabase(database) {
    const migrationDirectory = path.join(__dirname, '..', 'migrations', 'postgres');
    for (const migration of ['001_initial_schema.sql', '002_careers_and_service_details.sql']) {
        await database.query(fs.readFileSync(path.join(migrationDirectory, migration), 'utf8'));
    }
}

async function createTestContext({ logger = { error() {} } } = {}) {
    const { memoryDatabase, database, createPool } = createMemoryDatabase();
    const migrationDirectory = path.join(__dirname, '..', 'migrations', 'postgres');
    for (const migration of ['001_initial_schema.sql', '002_careers_and_service_details.sql']) {
        const sql = fs.readFileSync(path.join(migrationDirectory, migration), 'utf8')
            .replaceAll('TIMESTAMPTZ', 'TIMESTAMP');
        await database.query(sql);
    }
    const password = 'Test-only-password-123!';
    await database.query(
        'INSERT INTO admins (email, password_hash) VALUES ($1, $2)',
        ['admin@example.test', await bcrypt.hash(password, 4)]
    );
    const app = createApp({
        database,
        config: {
            production: false,
            sessionSecret: 'test-session-secret-with-more-than-32-characters',
            frontendOrigin: 'http://127.0.0.1:5500',
            smtp: null
        },
        logger
    });
    return { app, database, password, memoryDatabase, createPool };
}

module.exports = { createMemoryDatabase, createTestContext, preparePostgresDatabase };
