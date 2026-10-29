const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s().-]{7,30}$/;
const APPLICATION_STATUSES = new Set(['new', 'reviewing', 'shortlisted', 'interview', 'selected', 'rejected']);
const ENQUIRY_STATUSES = new Set(['new', 'in_progress', 'closed']);
const WORK_MODES = new Set(['onsite', 'hybrid', 'remote']);
const JOB_TYPES = new Set(['full_time', 'part_time', 'internship', 'contract']);
const SUBMISSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value, maximum, { required = true } = {}) {
    if (typeof value !== 'string') return required ? null : '';
    const result = value.trim();
    if ((!result && required) || result.length > maximum) return null;
    return result;
}

function email(value) {
    const result = text(value, 254);
    return result && EMAIL_PATTERN.test(result) ? result.toLowerCase() : null;
}

function phone(value, { required = false } = {}) {
    const result = text(value, 30, { required });
    if (result === null) return null;
    if (!result) return '';
    return PHONE_PATTERN.test(result) && /\d/.test(result) ? result : null;
}

function positiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validDate(value) {
    if (value === '' || value === null || value === undefined) return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
        ? value
        : undefined;
}

function validUrl(value) {
    if (value === '' || value === null || value === undefined) return '';
    const result = text(value, 2048);
    if (!result) return null;
    try {
        const url = new URL(result);
        return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.')
            ? url.toString()
            : null;
    } catch {
        return null;
    }
}

function skillsList(value, maximum = 30) {
    const skills = Array.isArray(value)
        ? value.map(skill => text(skill, 100))
        : typeof value === 'string'
            ? value.split(/[\n,]/).map(skill => text(skill, 100))
            : null;
    if (!skills) return null;
    const cleaned = skills.filter(skill => skill !== '');
    if (cleaned.length > maximum || cleaned.some(skill => skill === null)) return null;
    return cleaned;
}

function validateEnquiry(body = {}) {
    const rawService = body.serviceOfInterest !== undefined
        ? body.serviceOfInterest
        : body.subject !== undefined
            ? body.subject
            : 'General enquiry';
    const serviceOfInterest = text(rawService, 180);
    const result = {
        name: text(body.name, 120),
        email: email(body.email),
        phone: phone(body.phone),
        company: text(body.company, 160, { required: false }),
        serviceOfInterest,
        message: text(body.message, 5000)
    };
    const errors = {};
    for (const [field, value] of Object.entries(result)) {
        if (value === null) errors[field] = 'Check this field and try again.';
    }
    return { value: result, errors };
}

function validateApplication(body = {}) {
    const submissionId = text(body.submissionId, 36);
    const relevantSkills = skillsList(body.relevantSkills);
    const linkedinUrl = validUrl(body.linkedinUrl);
    const portfolioUrl = validUrl(body.portfolioUrl);
    const result = {
        jobId: positiveId(body.jobId),
        name: text(body.name, 120),
        email: email(body.email),
        phone: phone(body.phone, { required: true }),
        education: text(body.education, 240),
        experienceLevel: text(body.experienceLevel, 100),
        relevantSkills,
        linkedinUrl,
        portfolioUrl,
        coverLetter: text(body.coverLetter, 5000),
        submissionId: submissionId && SUBMISSION_ID_PATTERN.test(submissionId) ? submissionId : null
    };
    const errors = {};
    for (const [field, value] of Object.entries(result)) {
        if (value === null) errors[field] = 'Check this field and try again.';
    }
    return { value: result, errors };
}

function validateJob(body = {}) {
    const title = text(body.title, 160);
    const description = text(body.description, 10000);
    const location = text(body.location, 160);
    const workMode = text(body.workMode, 20);
    const department = text(body.department, 120);
    const jobType = text(body.jobType, 20);
    const experienceLevel = text(body.experienceLevel, 100);
    const responsibilities = text(body.responsibilities, 10000);
    const qualifications = text(body.qualifications, 10000);
    const deadline = validDate(body.deadline);
    const status = text(body.status, 20);
    const skills = skillsList(body.skills);
    const salaryRange = text(body.salaryRange, 120, { required: false });
    const openings = body.openings === '' || body.openings === null || body.openings === undefined
        ? null
        : Number(body.openings);
    const errors = {};
    if (!title) errors.title = 'Enter a role title (up to 160 characters).';
    if (!description) errors.description = 'Enter a role description (up to 10,000 characters).';
    if (!department) errors.department = 'Enter a department.';
    if (!JOB_TYPES.has(jobType)) errors.jobType = 'Choose a supported job type.';
    if (!location) errors.location = 'Enter a location.';
    if (!WORK_MODES.has(workMode)) errors.workMode = 'Choose onsite, hybrid, or remote.';
    if (!experienceLevel) errors.experienceLevel = 'Enter an experience level.';
    if (!responsibilities) errors.responsibilities = 'Describe the role responsibilities.';
    if (!qualifications) errors.qualifications = 'Describe the qualifications for this role.';
    if (deadline === undefined) errors.deadline = 'Use a valid YYYY-MM-DD deadline.';
    if (!skills || skills.length === 0) errors.skills = 'Provide at least one valid skill, up to 30.';
    if (salaryRange === null) errors.salaryRange = 'Use a confirmed salary or stipend range, or leave it blank.';
    if (openings !== null && (!Number.isSafeInteger(openings) || openings < 1)) errors.openings = 'Openings must be a positive whole number, or left blank.';
    if (!['draft', 'published', 'closed'].includes(status)) errors.status = 'Choose draft, published, or closed.';
    return {
        value: {
            title, description, department, jobType, location, workMode,
            experienceLevel, skills, responsibilities, qualifications,
            salaryRange, openings, deadline, status
        },
        errors
    };
}

module.exports = {
    APPLICATION_STATUSES,
    EMAIL_PATTERN,
    ENQUIRY_STATUSES,
    JOB_TYPES,
    WORK_MODES,
    email,
    phone,
    positiveId,
    text,
    validUrl,
    validateApplication,
    validateEnquiry,
    validateJob
};
