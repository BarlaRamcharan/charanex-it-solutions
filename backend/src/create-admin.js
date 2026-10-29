const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const bcrypt = require('bcryptjs');
const { loadConfig } = require('./config');
const { createDatabase } = require('./database');
const { migrate } = require('./migrate');

async function createAdmin(database, email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new Error('Enter a valid administrator email address.');
    }
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
        throw new Error('Administrator passwords must be 12 to 128 characters long.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await database.query(
        'INSERT INTO admins (email, password_hash) VALUES ($1, $2)',
        [normalizedEmail, passwordHash]
    );
}

if (require.main === module) {
    (async () => {
        let database;
        let prompt;
        try {
            const config = loadConfig();
            database = createDatabase(config);
            await migrate(database);
            prompt = readline.createInterface({ input: stdin, output: stdout });
            const email = await prompt.question('Administrator email: ');
            const password = await prompt.question('Administrator password (12+ characters): ');
            await createAdmin(database, email, password);
            console.log('Administrator created.');
        } catch (error) {
            console.error('Could not create administrator:', error.message);
            process.exitCode = 1;
        } finally {
            if (prompt) prompt.close();
            if (database) await database.end();
        }
    })();
}

module.exports = { createAdmin };
