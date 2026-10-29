const test = require('node:test');
const assert = require('node:assert/strict');
const { validateApplication, validateEnquiry, validateJob } = require('../src/validation');
const { RESUME_LIMIT, validateResume } = require('../src/resume');

test('contact and application fields reject invalid data and normalize email', () => {
    const enquiry = validateEnquiry({
        name: '  A Name ',
        email: ' PERSON@EXAMPLE.TEST ',
        phone: '',
        company: '',
        subject: ' Question ',
        message: ' Hello '
    });
    assert.deepEqual(enquiry.errors, {});
    assert.equal(enquiry.value.email, 'person@example.test');
    assert.ok(validateEnquiry({ name: 'A Name', email: 'person@example.test', serviceOfInterest: '', message: 'Hello' }).errors.serviceOfInterest);
    assert.equal(validateEnquiry({ name: '<script>', email: 'bad', message: '' }).errors.email, 'Check this field and try again.');
    assert.equal(validateApplication({ jobId: '0' }).errors.jobId, 'Check this field and try again.');
    const incompleteApplication = validateApplication({
        jobId: '1',
        name: 'Candidate',
        email: 'candidate@example.test',
        phone: '+1 555 555 5555',
        education: 'Student',
        experienceLevel: 'Student',
        relevantSkills: 'JavaScript'
    });
    assert.ok(incompleteApplication.errors.submissionId);
    assert.ok(incompleteApplication.errors.coverLetter);
    assert.ok(validateApplication({
        jobId: '1',
        name: 'Candidate',
        email: 'candidate@example.test',
        phone: '+1 555 555 5555',
        education: 'Student',
        experienceLevel: 'Student',
        relevantSkills: 'JavaScript',
        linkedinUrl: 'javascript:alert(1)',
        coverLetter: 'Interested.',
        submissionId: '00000000-0000-4000-8000-000000000001'
    }).errors.linkedinUrl);
});

test('job fields enforce work modes and calendar dates', () => {
    const good = validateJob({
        title: 'Engineer',
        department: 'Engineering',
        jobType: 'full_time',
        description: 'Role details',
        responsibilities: 'Build and maintain software.',
        qualifications: 'Relevant experience.',
        skills: ['Node.js', 'PostgreSQL'],
        location: 'Remote',
        workMode: 'remote',
        experienceLevel: 'Mid-level',
        deadline: '2027-01-31',
        status: 'draft'
    });
    assert.deepEqual(good.errors, {});
    assert.equal(validateJob({ workMode: 'everywhere', deadline: '2027-02-31' }).errors.workMode, 'Choose onsite, hybrid, or remote.');
    assert.ok(validateJob({ deadline: '2027-02-31' }).errors.deadline);
    assert.ok(validateJob({
        title: 'Engineer',
        description: 'Role details',
        skills: ['a'.repeat(101)],
        location: 'Remote',
        workMode: 'remote',
        status: 'draft'
    }).errors.skills);
});

test('resume validation checks extension, MIME, signature, and size', () => {
    const validPdf = validateResume({
        originalname: 'candidate.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7')
    });
    assert.equal(validPdf.valid, true);
    assert.equal(validPdf.value.name, 'resume.pdf');
    assert.equal(validateResume({
        originalname: '..\\candidate.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('not a PDF')
    }).valid, false);
    const docxFixture = Buffer.from('PK\x03\x04[Content_Types].xmlword/document.xml');
    assert.equal(validateResume({
        originalname: 'candidate.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: docxFixture
    }).valid, true);
    assert.match(validateResume({
        originalname: 'candidate.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.alloc(RESUME_LIMIT + 1)
    }).error, /5 MB/);
});
