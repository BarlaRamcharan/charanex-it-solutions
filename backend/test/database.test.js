const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../src/database');
const { migrate } = require('../src/migrate');
const { SQLiteSessionStore } = require('../src/session-store');

test('database directory is created and records survive reopening the SQLite file', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'charanex-sqlite-'));
    const databasePath = path.join(directory, 'data', 'charanex.sqlite');
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

    let database = openDatabase(databasePath);
    migrate(database);
    assert.equal(fs.existsSync(path.dirname(databasePath)), true);
    assert.equal(database.pragma('foreign_keys', { simple: true }), 1);
    database.prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)')
        .run('admin@example.test', 'test-hash');
    database.prepare(
        'INSERT INTO enquiries (name, email, subject, service_of_interest, message) VALUES (?, ?, ?, ?, ?)'
    ).run('Candidate', 'candidate@example.test', 'Question', 'General enquiry', 'Please contact me.');
    const job = database.prepare(
        `INSERT INTO jobs
         (title, department, job_type, description, responsibilities, qualifications,
          skills, location, work_mode, experience_level, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('Software Intern', 'Engineering', 'internship', 'Role description',
        'Responsibilities', 'Qualifications', '["JavaScript"]', 'Remote', 'remote', 'Student', 'published');
    const application = database.prepare(
        `INSERT INTO applications
         (job_id, name, email, education, experience_level, relevant_skills,
          cover_letter, submission_id, resume_name, resume_type, resume_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(Number(job.lastInsertRowid), 'Candidate', 'candidate@example.test', 'Student',
        'Student', '["JavaScript"]', 'I am interested.', '00000000-0000-4000-8000-000000000001',
        'resume.pdf', 'application/pdf', Buffer.from('%PDF-1.7 private resume'));
    database.close();

    database = openDatabase(databasePath);
    migrate(database);
    assert.equal(database.prepare('SELECT email FROM admins').get().email, 'admin@example.test');
    assert.equal(database.prepare('SELECT message FROM enquiries').get().message, 'Please contact me.');
    assert.equal(database.prepare('SELECT status FROM jobs').get().status, 'published');
    assert.equal(database.prepare('SELECT status FROM applications').get().status, 'new');
    assert.equal(database.prepare('SELECT resume_data FROM applications WHERE id = ?')
        .get(Number(application.lastInsertRowid)).resume_data.toString(), '%PDF-1.7 private resume');
    database.close();
});

test('administrator sessions remain in the SQLite database across store instances', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'charanex-session-'));
    const databasePath = path.join(directory, 'data', 'sessions.sqlite');
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const sessionId = 'test-session-id';
    const value = { adminId: 7, cookie: { expires: new Date(Date.now() + 60_000).toISOString() } };

    let database = openDatabase(databasePath);
    migrate(database);
    const store = new SQLiteSessionStore(database);
    await new Promise((resolve, reject) => store.set(sessionId, value, error => error ? reject(error) : resolve()));
    database.close();

    database = openDatabase(databasePath);
    const reopenedStore = new SQLiteSessionStore(database);
    const restored = await new Promise((resolve, reject) => reopenedStore.get(sessionId, (error, item) => error ? reject(error) : resolve(item)));
    assert.equal(restored.adminId, 7);
    database.close();
});
