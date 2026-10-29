const { Pool } = require('pg');

function createDatabase(config, PoolClass = Pool) {
    const pool = new PoolClass({
        connectionString: config.databaseUrl,
        ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000
    });

    return pool;
}

module.exports = { createDatabase };
