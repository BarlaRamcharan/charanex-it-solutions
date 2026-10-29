const { createApp } = require('./app');
const { loadConfig } = require('./config');
const { createDatabase } = require('./database');
const { migrate } = require('./migrate');

async function prepareDatabase(database, migrationRunner = migrate) {
    await database.query('SELECT 1');
    await migrationRunner(database);
    await database.query('SELECT 1');
}

async function start() {
    let database;
    try {
        const config = loadConfig();
        database = createDatabase(config);
        database.on('error', error => {
            console.error('Unexpected PostgreSQL idle client error:', error.message);
        });
        await prepareDatabase(database);
        const app = createApp({ database, config });
        const server = app.listen(config.port, '0.0.0.0', () => {
            console.log(`CharanEx backend listening on 0.0.0.0:${config.port}`);
        });

        let shuttingDown = false;
        const shutdown = signal => {
            if (shuttingDown) return;
            shuttingDown = true;
            console.log(`Received ${signal}; shutting down.`);
            server.close(error => {
                if (error) {
                    console.error('HTTP server shutdown failed:', error.message);
                    process.exitCode = 1;
                }
                database.end().catch(databaseError => {
                    console.error('PostgreSQL pool shutdown failed:', databaseError.message);
                    process.exitCode = 1;
                });
            });
        };
        process.once('SIGTERM', () => shutdown('SIGTERM'));
        process.once('SIGINT', () => shutdown('SIGINT'));
    } catch (error) {
        if (database) await database.end();
        throw error;
    }
}

if (require.main === module) {
    start().catch(error => {
        console.error('Backend startup failed:', error.message);
        process.exitCode = 1;
    });
}

module.exports = { prepareDatabase, start };
