const { Pool } = require('pg');
const tls = require('node:tls');

function createDatabase(config, PoolClass = Pool) {
    const ssl = config.databaseSsl
        ? {
            rejectUnauthorized: true,
            ...(config.databaseCa
                ? { ca: [...tls.rootCertificates, config.databaseCa] }
                : {})
        }
        : undefined;
    const pool = new PoolClass({
        connectionString: config.databaseUrl,
        ssl,
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000
    });

    return pool;
}

module.exports = { createDatabase };
