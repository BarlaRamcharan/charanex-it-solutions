const path = require('node:path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');
const { sendNotification } = require('./mailer');
const { PostgresSessionStore } = require('./session-store');
const { RESUME_LIMIT, validateResume } = require('./resume');
const {
    APPLICATION_STATUSES,
    ENQUIRY_STATUSES,
    positiveId,
    validateApplication,
    validateEnquiry,
    validateJob
} = require('./validation');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_EMAIL = 'If the credentials are valid, you are signed in.';
const ADMIN_JOB_COLUMNS = 'id, title, department, job_type AS "jobType", description, responsibilities, qualifications, skills, location, work_mode AS "workMode", experience_level AS "experienceLevel", salary_range AS "salaryRange", openings, deadline, status, created_at AS "createdAt", updated_at AS "updatedAt"';
const ENQUIRY_COLUMNS = 'id, name, email, phone, company, subject, service_of_interest AS "serviceOfInterest", message, status, created_at AS "createdAt"';
const APPLICATION_COLUMNS = 'a.id, a.job_id AS "jobId", j.title AS "jobTitle", j.department, j.job_type AS "jobType", a.name, a.email, a.phone, a.education, a.experience_level AS "experienceLevel", a.relevant_skills AS "relevantSkills", a.linkedin_url AS "linkedinUrl", a.portfolio_url AS "portfolioUrl", a.cover_letter AS "coverLetter", a.status, a.created_at AS "createdAt"';

function parseJsonList(value) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) {
        throw new Error('Stored list data failed its integrity check.');
    }
    return parsed;
}

function mapJob(row) {
    return row ? { ...row, skills: parseJsonList(row.skills) } : row;
}

function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function makeLimiter(windowMs, limit, message) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (_req, res) => res.status(429).json({ error: message })
    });
}

function makeUpload() {
    return multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: RESUME_LIMIT, files: 1, fields: 14, parts: 16 }
    }).single('resume');
}

function createApp({ database, config, sessionStore, logger = console }) {
    if (!database || !config) throw new Error('Database and configuration are required.');

    const app = express();
    const production = config.production;
    if (production) app.set('trust proxy', 1);
    app.disable('x-powered-by');
    app.use(helmet());

    app.use((req, res, next) => {
        if (!req.path.startsWith('/api/')) return next();
        const origin = req.get('origin');
        if (origin && origin === config.frontendOrigin) {
            res.setHeader('Access-Control-Allow-Origin', config.frontendOrigin);
            res.setHeader('Vary', 'Origin');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        }
        if (req.method === 'OPTIONS') return res.sendStatus(origin === config.frontendOrigin ? 204 : 403);
        next();
    });

    app.use(express.json({ limit: '50kb', type: 'application/json' }));
    app.use(express.urlencoded({ extended: false, limit: '20kb' }));
    app.use(session({
        name: 'charanex.sid',
        secret: config.sessionSecret,
        store: sessionStore || new PostgresSessionStore(database),
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: production,
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000
        }
    }));
    app.use('/api/admin', (_req, res, next) => {
        res.setHeader('Cache-Control', 'private, no-store');
        next();
    });

    const requireAdmin = asyncRoute(async (req, res, next) => {
        if (!req.session.adminId) return res.status(401).json({ error: 'Administrator sign-in is required.' });
        const { rows } = await database.query(
            'SELECT id, email FROM admins WHERE id = $1',
            [req.session.adminId]
        );
        const admin = rows[0];
        if (!admin) {
            await new Promise((resolve, reject) => {
                req.session.destroy(error => error ? reject(error) : resolve());
            });
            return res.status(401).json({ error: 'Administrator sign-in is required.' });
        }
        req.admin = admin;
        next();
    });

    const requireSameOrigin = (req, res, next) => {
        const origin = req.get('origin');
        const ownOrigin = `${req.protocol}://${req.get('host')}`;
        if (!origin || origin !== ownOrigin) {
            return res.status(403).json({ error: 'Request origin was not accepted.' });
        }
        next();
    };

    const contactLimiter = makeLimiter(60 * 60 * 1000, 5, 'Too many enquiries. Please try again later.');
    const applicationLimiter = makeLimiter(60 * 60 * 1000, 3, 'Too many applications. Please try again later.');
    const loginLimiter = makeLimiter(15 * 60 * 1000, 10, 'Too many sign-in attempts. Try again later.');
    const upload = makeUpload();

    app.get('/api/health', asyncRoute(async (_req, res) => {
        await database.query('SELECT 1');
        res.json({ status: 'ok' });
    }));

    app.get('/api/jobs', asyncRoute(async (_req, res) => {
        const { rows } = await database.query(
            `SELECT id, title, department, job_type AS "jobType", description,
                    responsibilities, qualifications, skills, location,
                    work_mode AS "workMode", experience_level AS "experienceLevel",
                    salary_range AS "salaryRange", openings, deadline
             FROM jobs
             WHERE status = 'published' AND (deadline IS NULL OR deadline >= CURRENT_DATE)
             ORDER BY created_at DESC`
        );
        res.json({ jobs: rows.map(mapJob) });
    }));

    app.post('/api/contact', contactLimiter, asyncRoute(async (req, res) => {
        if (typeof req.body.website === 'string' && req.body.website.trim()) {
            return res.status(400).json({ error: 'The enquiry could not be accepted.' });
        }
        const { value, errors } = validateEnquiry(req.body);
        if (Object.keys(errors).length) return res.status(422).json({ error: 'Check the highlighted fields.', fields: errors });

        const { rows } = await database.query(
            `INSERT INTO enquiries (name, email, phone, company, subject, service_of_interest, message)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
                value.name, value.email, value.phone || null, value.company || null,
                value.serviceOfInterest, value.serviceOfInterest, value.message
            ]
        );
        const id = rows[0].id;
        notifyOptional(config, logger, {
            subject: `New website enquiry: ${value.serviceOfInterest}`,
            text: `Enquiry #${id}\nName: ${value.name}\nEmail: ${value.email}\nService: ${value.serviceOfInterest}\n\n${value.message}`
        });
        res.status(201).json({ message: 'Your enquiry has been received.', id });
    }));

    app.post('/api/applications', applicationLimiter, (req, res, next) => {
        upload(req, res, error => {
            if (error) return next(error);
            next();
        });
    }, asyncRoute(async (req, res) => {
        if (typeof req.body.website === 'string' && req.body.website.trim()) {
            return res.status(400).json({ error: 'The application could not be accepted.' });
        }
        const { value, errors } = validateApplication(req.body);
        if (Object.keys(errors).length) return res.status(422).json({ error: 'Check the highlighted fields.', fields: errors });
        const resume = validateResume(req.file);
        if (!resume.valid) return res.status(422).json({ error: resume.error, fields: { resume: resume.error } });

        const { rows: jobs } = await database.query(
            `SELECT id FROM jobs
             WHERE id = $1 AND status = 'published'
               AND (deadline IS NULL OR deadline >= CURRENT_DATE)`,
            [value.jobId]
        );
        if (!jobs[0]) return res.status(404).json({ error: 'This role is no longer accepting applications.' });

        try {
            const { rows } = await database.query(
                `INSERT INTO applications
                 (job_id, name, email, phone, education, experience_level, relevant_skills,
                  linkedin_url, portfolio_url, cover_letter, submission_id,
                  resume_name, resume_type, resume_data)
                 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14)
                 RETURNING id`,
                [
                    value.jobId, value.name, value.email, value.phone || null,
                    value.education, value.experienceLevel, JSON.stringify(value.relevantSkills),
                    value.linkedinUrl || null, value.portfolioUrl || null,
                    value.coverLetter, value.submissionId,
                    resume.value.name, resume.value.type, resume.value.data
                ]
            );
            const id = rows[0].id;
            notifyOptional(config, logger, {
                subject: 'New careers application received',
                text: `Application #${id} received for role ${value.jobId}.`
            });
            res.status(201).json({ message: 'Your application has been received.', id });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: 'This application has already been received.' });
            }
            throw error;
        }
    }));

    app.post('/api/admin/login', loginLimiter, requireSameOrigin, asyncRoute(async (req, res) => {
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        if (!EMAIL_PATTERN.test(email) || password.length > 128) {
            return res.status(401).json({ error: SAFE_EMAIL });
        }
        const { rows } = await database.query(
            'SELECT id, email, password_hash FROM admins WHERE email = $1',
            [email]
        );
        const admin = rows[0];
        if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
            return res.status(401).json({ error: SAFE_EMAIL });
        }
        await new Promise((resolve, reject) => {
            req.session.regenerate(error => error ? reject(error) : resolve());
        });
        req.session.adminId = admin.id;
        await new Promise((resolve, reject) => {
            req.session.save(error => error ? reject(error) : resolve());
        });
        res.json({ message: 'Signed in.', email: admin.email });
    }));

    app.get('/api/admin/session', requireAdmin, (req, res) => {
        res.json({ authenticated: true, email: req.admin.email });
    });

    app.get('/api/admin/summary', requireAdmin, asyncRoute(async (_req, res) => {
        const { rows } = await database.query(`
            SELECT
                (SELECT COUNT(*)::int FROM enquiries) AS enquiries,
                (SELECT COUNT(*)::int FROM applications) AS applications,
                (SELECT COUNT(*)::int FROM jobs WHERE status = 'published'
                    AND (deadline IS NULL OR deadline >= CURRENT_DATE)) AS active_jobs
        `);
        res.json({ counts: rows[0] });
    }));

    app.post('/api/admin/logout', requireSameOrigin, requireAdmin, asyncRoute(async (req, res) => {
        await new Promise((resolve, reject) => {
            req.session.destroy(error => error ? reject(error) : resolve());
        });
        res.clearCookie('charanex.sid', { httpOnly: true, secure: production, sameSite: 'strict' });
        res.json({ message: 'Signed out.' });
    }));

    app.get('/api/admin/enquiries', requireAdmin, asyncRoute(async (req, res) => {
        const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 200) : '';
        const status = ENQUIRY_STATUSES.has(req.query.status) ? req.query.status : null;
        const { rows } = await database.query(
            `SELECT ${ENQUIRY_COLUMNS} FROM enquiries
             WHERE ($1 = '' OR name ILIKE $2 OR email ILIKE $2 OR service_of_interest ILIKE $2)
               AND ($3::text IS NULL OR status = $3)
             ORDER BY created_at DESC LIMIT 200`,
            [search, `%${search}%`, status]
        );
        res.json({ enquiries: rows });
    }));

    app.patch('/api/admin/enquiries/:id', requireSameOrigin, requireAdmin, asyncRoute(async (req, res) => {
        const id = positiveId(req.params.id);
        const status = req.body.status;
        if (!id || !ENQUIRY_STATUSES.has(status)) return res.status(422).json({ error: 'Choose a valid enquiry and status.' });
        const { rows } = await database.query(
            `UPDATE enquiries SET status = $1 WHERE id = $2 RETURNING ${ENQUIRY_COLUMNS}`,
            [status, id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Enquiry not found.' });
        res.json({ enquiry: rows[0] });
    }));

    app.delete('/api/admin/enquiries/:id', requireSameOrigin, requireAdmin, asyncRoute(async (req, res) => {
        const id = positiveId(req.params.id);
        if (!id) return res.status(422).json({ error: 'Invalid enquiry.' });
        const { rowCount } = await database.query('DELETE FROM enquiries WHERE id = $1', [id]);
        if (!rowCount) return res.status(404).json({ error: 'Enquiry not found.' });
        res.sendStatus(204);
    }));

    app.get('/api/admin/applications', requireAdmin, asyncRoute(async (req, res) => {
        const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 200) : '';
        const status = APPLICATION_STATUSES.has(req.query.status) ? req.query.status : null;
        const { rows } = await database.query(
            `SELECT ${APPLICATION_COLUMNS} FROM applications a JOIN jobs j ON j.id = a.job_id
             WHERE ($1 = '' OR a.name ILIKE $2 OR a.email ILIKE $2 OR j.title ILIKE $2 OR a.education ILIKE $2)
               AND ($3::text IS NULL OR a.status = $3)
             ORDER BY a.created_at DESC LIMIT 200`,
            [search, `%${search}%`, status]
        );
        res.json({
            applications: rows.map(application => ({
                ...application,
                relevantSkills: parseJsonList(application.relevantSkills)
            }))
        });
    }));

    app.patch('/api/admin/applications/:id', requireSameOrigin, requireAdmin, asyncRoute(async (req, res) => {
        const id = positiveId(req.params.id);
        const status = req.body.status;
        if (!id || !APPLICATION_STATUSES.has(status)) return res.status(422).json({ error: 'Choose a valid application and status.' });
        const { rows } = await database.query(
            'UPDATE applications SET status = $1 WHERE id = $2 RETURNING id, status',
            [status, id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Application not found.' });
        res.json({ application: rows[0] });
    }));

    app.delete('/api/admin/applications/:id', requireSameOrigin, requireAdmin, asyncRoute(async (req, res) => {
        const id = positiveId(req.params.id);
        if (!id) return res.status(422).json({ error: 'Invalid application.' });
        const { rowCount } = await database.query('DELETE FROM applications WHERE id = $1', [id]);
        if (!rowCount) return res.status(404).json({ error: 'Application not found.' });
        res.sendStatus(204);
    }));

    app.get('/api/admin/applications/:id/resume', requireAdmin, asyncRoute(async (req, res) => {
        const id = positiveId(req.params.id);
        if (!id) return res.status(422).json({ error: 'Invalid application.' });
        const { rows } = await database.query(
            'SELECT resume_type, resume_data FROM applications WHERE id = $1',
            [id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Resume not found.' });
        const { resume_type: type, resume_data: data } = rows[0];
        if (!Buffer.isBuffer(data) || !['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(type)) {
            throw new Error('Stored resume data failed its integrity check.');
        }
        res.setHeader('Content-Type', type);
        res.setHeader('Content-Disposition', `attachment; filename="resume-${id}.${type === 'application/pdf' ? 'pdf' : 'docx'}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(data);
    }));

    app.get('/api/admin/jobs', requireAdmin, asyncRoute(async (_req, res) => {
        const { rows } = await database.query(
            `SELECT ${ADMIN_JOB_COLUMNS} FROM jobs ORDER BY created_at DESC`
        );
        res.json({ jobs: rows.map(mapJob) });
    }));

    app.post('/api/admin/jobs', requireSameOrigin, requireAdmin, asyncRoute(async (req, res) => {
        const { value, errors } = validateJob(req.body);
        if (Object.keys(errors).length) return res.status(422).json({ error: 'Check the highlighted fields.', fields: errors });
        const { rows } = await database.query(
            `INSERT INTO jobs
             (title, department, job_type, description, responsibilities, qualifications,
              skills, location, work_mode, experience_level, salary_range, openings, deadline, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14)
             RETURNING id`,
            [
                value.title, value.department, value.jobType, value.description,
                value.responsibilities, value.qualifications, JSON.stringify(value.skills),
                value.location, value.workMode, value.experienceLevel,
                value.salaryRange || null, value.openings, value.deadline, value.status
            ]
        );
        const jobResult = await database.query(
            `SELECT ${ADMIN_JOB_COLUMNS} FROM jobs WHERE id = $1`,
            [rows[0].id]
        );
        res.status(201).json({ job: mapJob(jobResult.rows[0]) });
    }));

    app.patch('/api/admin/jobs/:id', requireSameOrigin, requireAdmin, asyncRoute(async (req, res) => {
        const id = positiveId(req.params.id);
        if (!id) return res.status(422).json({ error: 'Invalid job listing.' });
        const { value, errors } = validateJob(req.body);
        if (Object.keys(errors).length) return res.status(422).json({ error: 'Check the highlighted fields.', fields: errors });
        const { rowCount } = await database.query(
            `UPDATE jobs SET title=$1, department=$2, job_type=$3, description=$4,
             responsibilities=$5, qualifications=$6, skills=$7::jsonb, location=$8,
             work_mode=$9, experience_level=$10, salary_range=$11, openings=$12,
             deadline=$13, status=$14, updated_at=CURRENT_TIMESTAMP
             WHERE id=$15`,
            [
                value.title, value.department, value.jobType, value.description,
                value.responsibilities, value.qualifications, JSON.stringify(value.skills),
                value.location, value.workMode, value.experienceLevel,
                value.salaryRange || null, value.openings, value.deadline, value.status, id
            ]
        );
        if (!rowCount) return res.status(404).json({ error: 'Job listing not found.' });
        const { rows } = await database.query(
            `SELECT ${ADMIN_JOB_COLUMNS} FROM jobs WHERE id = $1`,
            [id]
        );
        res.json({ job: mapJob(rows[0]) });
    }));

    app.delete('/api/admin/jobs/:id', requireSameOrigin, requireAdmin, asyncRoute(async (req, res) => {
        const id = positiveId(req.params.id);
        if (!id) return res.status(422).json({ error: 'Invalid job listing.' });
        const { rows: applications } = await database.query(
            'SELECT 1 FROM applications WHERE job_id = $1 LIMIT 1',
            [id]
        );
        if (applications[0]) {
            return res.status(409).json({ error: 'This role has applications. Unpublish it instead of deleting it.' });
        }
        try {
            const { rowCount } = await database.query('DELETE FROM jobs WHERE id = $1', [id]);
            if (!rowCount) return res.status(404).json({ error: 'Job listing not found.' });
        } catch (error) {
            if (error.code === '23503') {
                return res.status(409).json({ error: 'This role has applications. Unpublish it instead of deleting it.' });
            }
            throw error;
        }
        res.sendStatus(204);
    }));

    const publicDirectory = path.join(__dirname, '..', 'public');
    app.use('/admin-assets', express.static(publicDirectory, { index: false, dotfiles: 'deny' }));
    app.get(['/admin', '/admin/'], (_req, res) => res.sendFile(path.join(publicDirectory, 'admin.html')));
    app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

    app.use((error, _req, res, _next) => {
        if (error instanceof multer.MulterError) {
            const message = error.code === 'LIMIT_FILE_SIZE'
                ? 'Resume files must be 5 MB or smaller.'
                : 'Attach one PDF or DOCX resume.';
            return res.status(422).json({ error: message, fields: { resume: message } });
        }
        if (error.type === 'entity.parse.failed') {
            return res.status(400).json({ error: 'Request body must be valid JSON.' });
        }
        if (error.code === '23503') {
            return res.status(409).json({ error: 'This record is linked to other records and cannot be deleted.' });
        }
        logger.error('Request failed:', error.message);
        res.status(500).json({ error: 'The request could not be completed. Please try again.' });
    });

    return app;
}

function notifyOptional(config, logger, message) {
    if (!config.smtp) return;
    void sendNotification(config.smtp, message).catch(error => {
        logger.error('Optional email notification failed:', error.message);
    });
}

module.exports = { createApp };
