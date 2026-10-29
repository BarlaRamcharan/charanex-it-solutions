const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function openDatabase(databasePath) {
    if (databasePath !== ':memory:') {
        fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    }

    const database = new Database(databasePath);
    try {
        database.pragma('foreign_keys = ON');
        database.pragma('journal_mode = WAL');
        database.pragma('synchronous = FULL');
        database.pragma('busy_timeout = 5000');
        if (databasePath !== ':memory:' && process.platform !== 'win32') {
            fs.chmodSync(databasePath, 0o600);
            for (const suffix of ['-wal', '-shm']) {
                const sidecar = `${databasePath}${suffix}`;
                if (fs.existsSync(sidecar)) fs.chmodSync(sidecar, 0o600);
            }
        }
    } catch (error) {
        database.close();
        throw error;
    }
    return database;
}

module.exports = { openDatabase };
