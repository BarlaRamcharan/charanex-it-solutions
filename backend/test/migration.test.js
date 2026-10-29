const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SQLite = require('better-sqlite3');
const { migrate } = require('../src/migrate');
const { importSqlite } = require('../src/import-sqlite');
const { createMemoryDatabase, preparePostgresDatabase } = require('../test-support/helpers');

function createMigrationPool() {
    const applied = new Set();
    const statements = [];
    const client = {
        async query(sql, values = []) {
            statements.push(sql.trim());
            if (sql.includes('SELECT 1 FROM schema_migrations')) {
                return { rows: [], rowCount: applied.has(values[0]) ? 1 : 0 };
            }
            if (sql.includes('INSERT INTO schema_migrations')) {
                applied.add(values[0]);
            }
            return { rows: [], rowCount: 0 };
        },
        release() {
            statements.push('RELEASE');
        }
    };
    return {
        applied,
        statements,
        async connect() {
            return client;
        }
    };
}

test('PostgreSQL migrations run in order, record versions, lock, and are repeatable', async () => {
    const pool = createMigrationPool();
    await migrate(pool);
    const expected = ['001_initial_schema.sql', '002_careers_and_service_details.sql'];
    assert.deepEqual([...pool.applied], expected);
    assert.ok(pool.statements.some(statement => statement.includes('pg_advisory_lock')));
    assert.ok(pool.statements.some(statement => statement.includes('pg_advisory_unlock')));
    assert.equal(pool.statements.filter(statement => statement === 'BEGIN').length, 2);
    assert.equal(pool.statements.filter(statement => statement === 'COMMIT').length, 2);

    pool.statements.length = 0;
    await migrate(pool);
    assert.equal(pool.statements.filter(statement => statement === 'BEGIN').length, 0);
});

test('SQLite import preserves records and private resume data without changing the source', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'charanex-postgres-import-'));
    const sqlitePath = path.join(directory, 'existing.sqlite');
    let source;
    const { database, sequenceResets } = createMemoryDatabase();
    t.after(async () => {
        if (source && source.open) source.close();
        await database.end();
        fs.rmSync(directory, { recursive: true, force: true });
    });

    source = new SQLite(sqlitePath);
    for (const migration of ['001_initial_schema.sql', '002_careers_and_service_details.sql']) {
        source.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', migration), 'utf8'));
    }
    source.prepare(
        'INSERT INTO admins (id, email, password_hash) VALUES (?, ?, ?)'
    ).run(7, 'admin@example.test', 'stored-password-hash');
    source.prepare(
        `INSERT INTO enquiries
         (id, name, email, subject, service_of_interest, message)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(11, 'Contact', 'contact@example.test', 'General enquiry', 'General enquiry', 'Keep this enquiry.');
    source.prepare(
        `INSERT INTO jobs
         (id, title, description, skills, location, work_mode, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(13, 'Software Intern', 'Role description', '["JavaScript"]', 'Remote', 'remote', 'published');
    source.prepare(
        `INSERT INTO applications
         (id, job_id, name, email, resume_name, resume_type, resume_data,
          education, relevant_skills, submission_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(17, 13, 'Candidate', 'candidate@example.test', 'resume.pdf',
        'application/pdf', Buffer.from('%PDF-1.7 private resume'), 'Student', '["JavaScript"]',
        '00000000-0000-4000-8000-000000000001');
    const sessionValue = JSON.stringify({ adminId: 7, cookie: { expires: new Date(Date.now() + 60_000).toISOString() } });
    source.prepare('INSERT INTO admin_sessions (sid, sess, expire) VALUES (?, ?, ?)')
        .run('session-id', sessionValue, Date.now() + 60_000);
    await preparePostgresDatabase(database);

    const imported = await importSqlite(source, database);
    assert.deepEqual(imported, { admins: 1, enquiries: 1, jobs: 1, applications: 1, admin_sessions: 1 });
    assert.deepEqual(sequenceResets.map(reset => reset.sequenceValue), [7, 11, 13, 17]);
    assert.equal(source.prepare('SELECT COUNT(*) AS count FROM applications').get().count, 1);
    const result = await database.query(
        `SELECT a.id, a.resume_data, a.relevant_skills, j.skills
         FROM applications a JOIN jobs j ON j.id = a.job_id`
    );
    assert.equal(result.rows[0].id, 17);
    assert.equal(result.rows[0].resume_data.toString(), '%PDF-1.7 private resume');
    assert.deepEqual(result.rows[0].relevant_skills, ['JavaScript']);
    assert.deepEqual(result.rows[0].skills, ['JavaScript']);
    const { rows: sessions } = await database.query('SELECT sid, sess FROM admin_sessions');
    assert.equal(sessions[0].sid, 'session-id');
    assert.equal(sessions[0].sess.adminId, 7);

    await assert.rejects(() => importSqlite(source, database), /unique|duplicate/i);
    const { rows: preserved } = await database.query('SELECT COUNT(*)::int AS count FROM applications');
    assert.equal(preserved[0].count, 1);
    assert.equal(source.prepare('SELECT COUNT(*) AS count FROM applications').get().count, 1);
});
