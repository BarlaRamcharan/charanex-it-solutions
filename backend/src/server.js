const { createApp } = require('./app');
const { loadConfig } = require('./config');
const { openDatabase } = require('./database');
const { migrate } = require('./migrate');

async function start() {
    let database;
    try {
        const config = loadConfig();
        database = openDatabase(config.databasePath);
        migrate(database);
        database.prepare('SELECT 1').get();
        const app = createApp({ database, config });
        const server = app.listen(config.port, '0.0.0.0', () => {
            console.log(`CharanEx backend listening on 0.0.0.0:${config.port}`);
        });

        let shuttingDown = false;
        const shutdown = signal => {
            if (shuttingDown) return;
            shuttingDown = true;
            console.log(`Received ${signal}; shutting down.`);
            server.close(() => {
                database.close();
                process.exitCode = 0;
            });
        };
        process.once('SIGTERM', () => shutdown('SIGTERM'));
        process.once('SIGINT', () => shutdown('SIGINT'));
    } catch (error) {
        if (database && database.open) database.close();
        throw error;
    }
}

start().catch(error => {
    console.error('Backend startup failed:', error.message);
    process.exitCode = 1;
});
