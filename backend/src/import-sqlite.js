const Database = require('better-sqlite3');
const { loadConfig } = require('./config');
const { createDatabase } = require('./database');
const { migrate } = require('./migrate');

const TABLES = ['admins', 'enquiries', 'jobs', 'applications', 'admin_sessions'];

function parseJsonArray(value, label) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) {
        throw new Error(`SQLite ${label} data is not a JSON array; import stopped without changing PostgreSQL.`);
    }
    return JSON.stringify(parsed);
}

async function insertRows(client, table, rows) {
    const columns = {
        admins: ['id', 'email', 'password_hash', 'created_at'],
        enquiries: ['id', 'name', 'email', 'phone', 'company', 'subject', 'message', 'status', 'created_at', 'service_of_interest'],
        jobs: ['id', 'title', 'description', 'skills', 'location', 'work_mode', 'deadline', 'status', 'created_at', 'updated_at', 'department', 'job_type', 'experience_level', 'responsibilities', 'qualifications', 'salary_range', 'openings'],
        applications: ['id', 'job_id', 'name', 'email', 'phone', 'cover_letter', 'resume_name', 'resume_type', 'resume_data', 'status', 'created_at', 'education', 'experience_level', 'relevant_skills', 'linkedin_url', 'portfolio_url', 'submission_id'],
        admin_sessions: ['sid', 'sess', 'expire']
    }[table];
    if (!columns) throw new Error(`Unsupported SQLite import table: ${table}`);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const queryColumns = columns.map(column => `"${column}"`).join(', ');
    const statement = `INSERT INTO "${table}" (${queryColumns}) VALUES (${placeholders})`;

    for (const row of rows) {
        const values = columns.map(column => {
            if (table === 'admin_sessions' && column === 'sess') {
                JSON.parse(row.sess);
                return row.sess;
            }
            if (table === 'admin_sessions' && column === 'expire') {
                return new Date(row.expire);
            }
            if (table === 'jobs' && column === 'skills') {
                return parseJsonArray(row.skills, 'job skills');
            }
            if (table === 'applications' && column === 'relevant_skills') {
                return parseJsonArray(row.relevant_skills, 'application skills');
            }
            return row[column];
        });
        const sql = table === 'jobs'
            ? `INSERT INTO "jobs" (${queryColumns}) VALUES (${columns.map((column, index) => `$${index + 1}${column === 'skills' ? '::jsonb' : ''}`).join(', ')})`
            : table === 'admin_sessions'
                ? `INSERT INTO "admin_sessions" (${queryColumns}) VALUES ($1, $2::jsonb, $3)`
                : statement;
        await client.query(sql, values);
    }
}

async function importSqlite(source, pool) {
    const client = await pool.connect();
    let sourceTransaction = false;
    let targetTransaction = false;
    try {
        source.exec('BEGIN');
        sourceTransaction = true;
        await client.query('BEGIN');
        targetTransaction = true;
        const counts = Object.fromEntries(TABLES.map(table => [table, 0]));
        for (const table of TABLES) {
            const rows = source.prepare(`SELECT * FROM "${table}"`).iterate();
            for (const row of rows) {
                if (table === 'admin_sessions' && row.expire <= Date.now()) continue;
                await insertRows(client, table, [row]);
                counts[table] += 1;
            }
        }
        for (const table of TABLES.slice(0, 4)) {
            await client.query(
                `SELECT setval(pg_get_serial_sequence('${table}', 'id'),
                    COALESCE((SELECT MAX(id) FROM "${table}"), 1),
                    EXISTS (SELECT 1 FROM "${table}"))`
            );
        }
        source.exec('COMMIT');
        sourceTransaction = false;
        await client.query('COMMIT');
        targetTransaction = false;
        return counts;
    } catch (error) {
        if (targetTransaction) await client.query('ROLLBACK');
        if (sourceTransaction) source.exec('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    (async () => {
        let pool;
        let source;
        try {
            const sqlitePath = process.argv[2];
            if (!sqlitePath) {
                throw new Error('Provide the existing SQLite database path: npm run import:sqlite -- <path>');
            }
            const config = loadConfig();
            source = new Database(sqlitePath, { readonly: true, fileMustExist: true });
            pool = createDatabase(config);
            await migrate(pool);
            const counts = await importSqlite(source, pool);
            console.log('SQLite records imported without modifying the source file:', counts);
        } catch (error) {
            console.error('SQLite import failed:', error.message);
            process.exitCode = 1;
        } finally {
            if (source) source.close();
            if (pool) await pool.end();
        }
    })();
}

module.exports = { importSqlite };
