const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./config');
const { openDatabase } = require('./database');

function migrate(database, migrationsDirectory = path.join(__dirname, '..', 'migrations')) {
    database.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const files = fs.readdirSync(migrationsDirectory)
        .filter(file => /^\d+_.+\.sql$/.test(file))
        .sort();
    const recordMigration = database.prepare('INSERT INTO schema_migrations (name) VALUES (?)');
    const migrationExists = database.prepare('SELECT 1 FROM schema_migrations WHERE name = ?');

    for (const file of files) {
        if (migrationExists.get(file)) continue;
        const sql = fs.readFileSync(path.join(migrationsDirectory, file), 'utf8');
        database.transaction(() => {
            database.exec(sql);
            recordMigration.run(file);
        })();
    }
}

if (require.main === module) {
    let database;
    try {
        const config = loadConfig();
        database = openDatabase(config.databasePath);
        migrate(database);
        console.log('Database migrations completed.');
    } catch (error) {
        console.error('Database migration failed:', error.message);
        process.exitCode = 1;
    } finally {
        if (database && database.open) database.close();
    }
}

module.exports = { migrate };
