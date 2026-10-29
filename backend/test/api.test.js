const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestContext } = require('../test-support/helpers');

const origin = 'http://127.0.0.1';
const validEnquiry = {
    name: 'Casey Example',
    email: 'casey@example.test',
    phone: '',
    company: '',
    subject: 'Website enquiry',
    serviceOfInterest: 'Web Development',
    message: 'Please contact me about web development.'
};

function applicationRequest(app, jobId, submissionId = '00000000-0000-4000-8000-000000000001') {
    const builder = request(app).post('/api/applications');
    const fields = {
        jobId: String(jobId),
        submissionId,
        name: 'Candidate',
        email: 'candidate@example.test',
        phone: '+1 555 555 5555',
        education: 'BSc Computer Science',
        experienceLevel: 'Student',
        relevantSkills: 'JavaScript, Node.js',
        linkedinUrl: 'https://www.linkedin.com/in/candidate',
        portfolioUrl: 'https://github.com/candidate',
        coverLetter: 'Interested in the role.'
    };
    for (const [name, value] of Object.entries(fields)) builder.field(name, value);
    return builder;
}

async function signedIn(app, password) {
    const agent = request.agent(app);
    const response = await agent
        .post('/api/admin/login')
        .set('Origin', origin)
        .set('Host', '127.0.0.1')
        .send({ email: 'admin@example.test', password });
    assert.equal(response.status, 200);
    return agent;
}

test('contact endpoint validates, rate-limits through middleware, and persists valid enquiries', async t => {
    const { app, database } = await createTestContext();
    t.after(() => database.end());

    const invalid = await request(app).post('/api/contact').send({ ...validEnquiry, email: 'invalid' });
    assert.equal(invalid.status, 422);
    assert.ok(invalid.body.fields.email);

    const spam = await request(app).post('/api/contact').send({ ...validEnquiry, website: 'bot' });
    assert.equal(spam.status, 400);
    const accepted = await request(app).post('/api/contact').send(validEnquiry);
    assert.equal(accepted.status, 201);
    const { rows } = await database.query('SELECT name, email, status, service_of_interest FROM enquiries');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, 'casey@example.test');
    assert.equal(rows[0].service_of_interest, 'Web Development');
});

test('contact endpoint rejects submissions above the per-IP limit', async t => {
    const { app, database } = await createTestContext();
    t.after(() => database.end());
    const responses = [];
    for (let index = 0; index < 6; index++) {
        responses.push(await request(app).post('/api/contact').send({
            ...validEnquiry,
            email: `casey${index}@example.test`
        }));
    }
    assert.deepEqual(responses.slice(0, 5).map(response => response.status), [201, 201, 201, 201, 201]);
    assert.equal(responses[5].status, 429);
});

test('contact endpoint returns explicit malformed JSON and missing-route errors', async t => {
    const { app, database } = await createTestContext();
    t.after(() => database.end());
    const malformed = await request(app)
        .post('/api/contact')
        .set('Content-Type', 'application/json')
        .send('{');
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error, 'Request body must be valid JSON.');
    const missing = await request(app).get('/api/not-a-route');
    assert.equal(missing.status, 404);
});

test('database health endpoint reports availability and database failures', async t => {
    const { app, database } = await createTestContext();
    t.after(() => database.end());
    const healthy = await request(app).get('/api/health');
    assert.equal(healthy.status, 200);
    assert.deepEqual(healthy.body, { status: 'ok' });

    database.query = async () => {
        throw new Error('test database unavailable');
    };
    const unavailable = await request(app).get('/api/health');
    assert.equal(unavailable.status, 500);
    assert.deepEqual(unavailable.body, { error: 'The request could not be completed. Please try again.' });
});

test('public API exposes only the configured site origin and serves an unprivileged admin shell', async t => {
    const { app, database } = await createTestContext();
    t.after(() => database.end());
    const preflight = await request(app)
        .options('/api/contact')
        .set('Origin', 'http://127.0.0.1:5500')
        .set('Access-Control-Request-Method', 'POST');
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers['access-control-allow-origin'], 'http://127.0.0.1:5500');
    const rejectedOrigin = await request(app)
        .options('/api/contact')
        .set('Origin', 'https://untrusted.example')
        .set('Access-Control-Request-Method', 'POST');
    assert.equal(rejectedOrigin.status, 403);
    const dashboard = await request(app).get('/admin');
    assert.equal(dashboard.status, 200);
    assert.match(dashboard.text, /Sign in/);
    assert.equal((await request(app).get('/api/admin/session')).status, 401);
});

test('admin authentication protects records and manages applications, resumes, and jobs', async t => {
    const { app, database, password } = await createTestContext();
    t.after(() => database.end());

    const denied = await request(app).get('/api/admin/applications');
    assert.equal(denied.status, 401);

    const badLogin = await request(app)
        .post('/api/admin/login')
        .set('Origin', origin)
        .set('Host', '127.0.0.1')
        .send({ email: 'admin@example.test', password: 'wrong-password' });
    assert.equal(badLogin.status, 401);
    const agent = await signedIn(app, password);

    const createdJob = await agent.post('/api/admin/jobs')
        .set('Origin', origin)
        .set('Host', '127.0.0.1')
        .send({
            title: 'Software Intern',
            department: 'Engineering',
            jobType: 'internship',
            description: 'Help maintain web applications.',
            responsibilities: 'Implement and test web features.',
            qualifications: 'Currently studying software development.',
            skills: ['JavaScript', 'Node.js'],
            location: 'Hyderabad',
            workMode: 'hybrid',
            experienceLevel: 'Student',
            salaryRange: '',
            openings: '',
            deadline: '',
            status: 'published'
        });
    assert.equal(createdJob.status, 201);
    const jobId = createdJob.body.job.id;

    const publicJobs = await request(app).get('/api/jobs');
    assert.equal(publicJobs.status, 200);
    assert.equal(publicJobs.body.jobs.length, 1);
    assert.equal(publicJobs.body.jobs[0].department, 'Engineering');
    assert.equal(publicJobs.body.jobs[0].jobType, 'internship');
    const unpublished = await agent.patch(`/api/admin/jobs/${jobId}`)
        .set('Origin', origin)
        .set('Host', '127.0.0.1')
        .send({
            ...createdJob.body.job,
            description: 'Updated role details.',
            deadline: '',
            status: 'draft'
        });
    assert.equal(unpublished.status, 200);
    assert.equal(unpublished.body.job.description, 'Updated role details.');
    assert.equal((await request(app).get('/api/jobs')).body.jobs.length, 0);
    const republished = await agent.patch(`/api/admin/jobs/${jobId}`)
        .set('Origin', origin)
        .set('Host', '127.0.0.1')
        .send({
            ...unpublished.body.job,
            deadline: '',
            status: 'published'
        });
    assert.equal(republished.status, 200);
        const closed = await agent.patch(`/api/admin/jobs/${jobId}`)
            .set('Origin', origin)
            .set('Host', '127.0.0.1')
            .send({
                ...republished.body.job,
                deadline: '',
                status: 'closed'
            });
        assert.equal(closed.status, 200);
        assert.equal((await request(app).get('/api/jobs')).body.jobs.length, 0);
        const reopened = await agent.patch(`/api/admin/jobs/${jobId}`)
            .set('Origin', origin)
            .set('Host', '127.0.0.1')
            .send({
                ...closed.body.job,
                deadline: '',
                status: 'published'
            });
        assert.equal(reopened.status, 200);

        const invalidUpload = await applicationRequest(app, jobId)
        .attach('resume', Buffer.from('not a PDF'), { filename: 'resume.pdf', contentType: 'application/pdf' });
    assert.equal(invalidUpload.status, 422);

    const oversizedUpload = await applicationRequest(app, jobId, '00000000-0000-4000-8000-000000000002')
        .attach('resume', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'resume.pdf', contentType: 'application/pdf' });
    assert.equal(oversizedUpload.status, 422);
    assert.match(oversizedUpload.body.error, /5 MB/);

    const application = await applicationRequest(app, jobId)
        .attach('resume', Buffer.from('%PDF-1.7 valid test fixture'), { filename: 'resume.pdf', contentType: 'application/pdf' });
    assert.equal(application.status, 201);
    const applicationId = application.body.id;

    const protectedResume = await request(app).get(`/api/admin/applications/${applicationId}/resume`);
    assert.equal(protectedResume.status, 401);

    const list = await agent.get('/api/admin/applications');
    assert.equal(list.status, 200);
    assert.equal(list.body.applications.length, 1);
    assert.equal('resume_data' in list.body.applications[0], false);
    assert.deepEqual(list.body.applications[0].relevantSkills, ['JavaScript', 'Node.js']);
    assert.equal(list.body.applications[0].education, 'BSc Computer Science');
    const summary = await agent.get('/api/admin/summary');
    const counts = Object.fromEntries(Object.entries(summary.body.counts)
        .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
    assert.deepEqual(counts, { enquiries: 0, applications: 1, active_jobs: 1 });

    const downloaded = await agent.get(`/api/admin/applications/${applicationId}/resume`);
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers['content-type'], 'application/pdf');
    assert.match(downloaded.headers['content-disposition'], /attachment/);
    assert.equal(downloaded.text, undefined);
    assert.equal(downloaded.body.toString(), '%PDF-1.7 valid test fixture');

    const updated = await agent.patch(`/api/admin/applications/${applicationId}`)
        .set('Origin', origin)
        .set('Host', '127.0.0.1')
        .send({ status: 'reviewing' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.application.status, 'reviewing');
    const selected = await agent.patch(`/api/admin/applications/${applicationId}`)
        .set('Origin', origin)
        .set('Host', '127.0.0.1')
        .send({ status: 'interview' });
    assert.equal(selected.status, 200);
    assert.equal(selected.body.application.status, 'interview');

    const protectedDeleteJob = await agent.delete(`/api/admin/jobs/${jobId}`)
        .set('Origin', origin)
        .set('Host', '127.0.0.1');
    assert.equal(protectedDeleteJob.status, 409);

    const removedApplication = await agent.delete(`/api/admin/applications/${applicationId}`)
        .set('Origin', origin)
        .set('Host', '127.0.0.1');
    assert.equal(removedApplication.status, 204);
    assert.equal((await agent.get(`/api/admin/applications/${applicationId}/resume`)).status, 404);
    const removedJob = await agent.delete(`/api/admin/jobs/${jobId}`)
        .set('Origin', origin)
        .set('Host', '127.0.0.1');
    assert.equal(removedJob.status, 204);

    const logout = await agent.post('/api/admin/logout')
        .set('Origin', origin)
        .set('Host', '127.0.0.1')
        .send({});
    assert.equal(logout.status, 200);
    assert.equal((await agent.get('/api/admin/applications')).status, 401);
});

test('application submission IDs prevent duplicate database records', async t => {
    const { app, database, password } = await createTestContext();
    t.after(() => database.end());
    const agent = await signedIn(app, password);
    const createdJob = await agent.post('/api/admin/jobs')
        .set('Origin', origin)
        .set('Host', '127.0.0.1')
        .send({
            title: 'Software Intern',
            department: 'Engineering',
            jobType: 'internship',
            description: 'Help maintain web applications.',
            responsibilities: 'Implement web features.',
            qualifications: 'Currently studying software development.',
            skills: ['JavaScript'],
            location: 'Remote',
            workMode: 'remote',
            experienceLevel: 'Student',
            status: 'published'
        });
    const jobId = createdJob.body.job.id;
    const createSubmission = () => applicationRequest(app, jobId)
        .attach('resume', Buffer.from('%PDF-1.7 valid test fixture'), { filename: 'resume.pdf', contentType: 'application/pdf' });
    assert.equal((await createSubmission()).status, 201);
    assert.equal((await createSubmission()).status, 409);
    const { rows } = await database.query('SELECT id FROM applications');
    assert.equal(rows.length, 1);
});

test('admins can search, filter, update, and delete contact enquiries', async t => {
    const { app, database, password } = await createTestContext();
    t.after(() => database.end());
    const submitted = await request(app).post('/api/contact').send(validEnquiry);
    assert.equal(submitted.status, 201);
    const agent = await signedIn(app, password);
    const search = await agent.get('/api/admin/enquiries?search=Web%20Development&status=new');
    assert.equal(search.status, 200);
    assert.equal(search.body.enquiries.length, 1);
    const id = search.body.enquiries[0].id;
    const updated = await agent.patch(`/api/admin/enquiries/${id}`)
        .set('Origin', origin)
        .set('Host', '127.0.0.1')
        .send({ status: 'in_progress' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.enquiry.status, 'in_progress');
    const deleted = await agent.delete(`/api/admin/enquiries/${id}`)
        .set('Origin', origin)
        .set('Host', '127.0.0.1');
    assert.equal(deleted.status, 204);
});

test('admin mutations reject cross-origin requests and invalid job records', async t => {
    const { app, database, password } = await createTestContext();
    t.after(() => database.end());
    const agent = await signedIn(app, password);
    const crossOrigin = await agent.post('/api/admin/jobs')
        .set('Origin', 'https://untrusted.example')
        .set('Host', '127.0.0.1')
        .send({});
    assert.equal(crossOrigin.status, 403);

    const invalid = await agent.post('/api/admin/jobs')
        .set('Origin', origin)
        .set('Host', '127.0.0.1')
        .send({ title: 'Bad role', workMode: 'unknown' });
    assert.equal(invalid.status, 422);
});
