const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/migrate');
const { openDatabase } = require('../src/database');

test('SQLite migrations create the complete schema, preserve records, and are repeatable', t => {
    const database = openDatabase(':memory:');
    t.after(() => database.close());

    migrate(database);
    database.prepare(
        'INSERT INTO enquiries (name, email, subject, service_of_interest, message) VALUES (?, ?, ?, ?, ?)'
    ).run('Existing Contact', 'existing@example.test', 'Existing', 'General enquiry', 'Keep this record.');
    migrate(database);

    assert.deepEqual(database.prepare('SELECT name FROM schema_migrations ORDER BY name').all(),
        [{ name: '001_initial_schema.sql' }, { name: '002_careers_and_service_details.sql' }]);
    assert.equal(database.prepare('SELECT message FROM enquiries WHERE email = ?').get('existing@example.test').message,
        'Keep this record.');
    assert.ok(database.prepare('PRAGMA table_info(applications)').all()
        .some(column => column.name === 'submission_id'));
    assert.ok(database.prepare('PRAGMA foreign_key_list(applications)').all()
        .some(key => key.table === 'jobs'));
});
