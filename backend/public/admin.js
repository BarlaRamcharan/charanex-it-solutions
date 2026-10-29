const loginPanel = document.querySelector('#login-panel');
const dashboard = document.querySelector('#dashboard');
const notice = document.querySelector('#notice');
const loginForm = document.querySelector('#login-form');
const logoutButton = document.querySelector('#logout');
const lists = {
    enquiries: document.querySelector('#enquiries-list'),
    applications: document.querySelector('#applications-list'),
    jobs: document.querySelector('#jobs-list')
};
let activeTab = 'enquiries';
let searchTimer;

async function request(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: {
            ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...options.headers
        }
    });
    if (response.status === 204) return null;
    let data;
    try {
        data = await response.json();
    } catch {
        if (response.ok) throw new Error('The server returned an invalid response.');
        data = {};
    }
    if (!response.ok) {
        if (response.status === 401 && !url.endsWith('/login')) showLogin();
        throw new Error(data.error || 'The request could not be completed.');
    }
    return data;
}

function showNotice(message, error = false) {
    notice.textContent = message;
    notice.classList.toggle('error', error);
    notice.classList.toggle('success', !error);
}

async function runAdminAction(action) {
    try {
        await action();
    } catch (error) {
        showNotice(error.message, true);
    }
}

function showLogin() {
    loginPanel.hidden = false;
    dashboard.hidden = true;
    logoutButton.hidden = true;
}

function showDashboard(email) {
    loginPanel.hidden = true;
    dashboard.hidden = false;
    logoutButton.hidden = false;
    document.querySelector('#signed-in-as').textContent = email;
}

async function loadSummary() {
    const data = await request('/api/admin/summary');
    document.querySelector('#summary-enquiries').textContent = data.counts.enquiries;
    document.querySelector('#summary-applications').textContent = data.counts.applications;
    document.querySelector('#summary-active-jobs').textContent = data.counts.active_jobs;
}

function node(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
}

function addButton(container, label, action, className = 'button secondary') {
    const button = node('button', className, label);
    button.type = 'button';
    button.addEventListener('click', () => runAdminAction(action));
    container.append(button);
    return button;
}

async function loadEnquiries() {
    const params = new URLSearchParams({
        search: document.querySelector('#enquiry-search').value,
        status: document.querySelector('#enquiry-status').value
    });
    const data = await request(`/api/admin/enquiries?${params}`);
    lists.enquiries.replaceChildren();
    if (!data.enquiries.length) lists.enquiries.append(node('p', 'empty', 'No enquiries found.'));
    data.enquiries.forEach(item => {
        const card = node('article', 'record');
        const heading = node('div', 'record-heading');
        heading.append(node('h3', '', item.serviceOfInterest || item.subject), node('span', 'badge', item.status.replace('_', ' ')));
        card.append(heading);
        card.append(node('p', 'record-meta', `${item.name} · ${item.email}${item.phone ? ` · ${item.phone}` : ''}${item.company ? ` · ${item.company}` : ''}`));
        card.append(node('p', 'record-meta', new Date(item.createdAt).toLocaleString()));
        card.append(node('p', 'record-message', item.message));
        const actions = node('div', 'record-actions');
        const status = document.createElement('select');
        status.setAttribute('aria-label', `Status for enquiry ${item.id}`);
        [['new', 'New'], ['in_progress', 'In progress'], ['closed', 'Closed']].forEach(([value, label]) => {
            const option = node('option', '', label);
            option.value = value;
            option.selected = value === item.status;
            status.append(option);
        });
        status.addEventListener('change', () => runAdminAction(async () => {
            await request(`/api/admin/enquiries/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: status.value }) });
            await loadEnquiries();
            await loadSummary();
            showNotice('Enquiry updated.');
        }));
        actions.append(status);
        addButton(actions, 'Delete', async () => {
            if (!window.confirm('Delete this enquiry permanently?')) return;
            await request(`/api/admin/enquiries/${item.id}`, { method: 'DELETE' });
            await loadEnquiries();
            await loadSummary();
            showNotice('Enquiry deleted.');
        }, 'button danger');
        card.append(actions);
        lists.enquiries.append(card);
    });
}

async function loadApplications() {
    const params = new URLSearchParams({
        search: document.querySelector('#application-search').value,
        status: document.querySelector('#application-status').value
    });
    const data = await request(`/api/admin/applications?${params}`);
    lists.applications.replaceChildren();
    if (!data.applications.length) lists.applications.append(node('p', 'empty', 'No applications found.'));
    data.applications.forEach(item => {
        const card = node('article', 'record');
        const heading = node('div', 'record-heading');
        heading.append(node('h3', '', item.name), node('span', 'badge', item.status));
        card.append(heading);
        card.append(node('p', 'record-meta', `${item.jobTitle} · ${item.department} · ${item.email}${item.phone ? ` · ${item.phone}` : ''}`));
        card.append(node('p', 'record-meta', `Education: ${item.education} · Experience: ${item.experienceLevel}`));
        if (item.relevantSkills.length) card.append(node('p', 'record-meta', `Skills: ${item.relevantSkills.join(', ')}`));
        const profileLinks = node('div', 'record-actions');
        for (const [label, value] of [['LinkedIn profile', item.linkedinUrl], ['Portfolio / GitHub', item.portfolioUrl]]) {
            if (!value) continue;
            const link = node('a', 'button secondary', label);
            link.href = value;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            profileLinks.append(link);
        }
        if (profileLinks.childElementCount) card.append(profileLinks);
        if (item.coverLetter) card.append(node('p', 'record-message', item.coverLetter));
        const actions = node('div', 'record-actions');
        const resume = node('a', 'button secondary', 'Download resume');
        resume.href = `/api/admin/applications/${item.id}/resume`;
        actions.append(resume);
        const status = document.createElement('select');
        status.setAttribute('aria-label', `Status for application ${item.id}`);
        [['new', 'New'], ['reviewing', 'Reviewing'], ['shortlisted', 'Shortlisted'], ['interview', 'Interview'], ['selected', 'Selected'], ['rejected', 'Rejected']].forEach(([value, label]) => {
            const option = node('option', '', label);
            option.value = value;
            option.selected = value === item.status;
            status.append(option);
        });
        status.addEventListener('change', () => runAdminAction(async () => {
            await request(`/api/admin/applications/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: status.value }) });
            await loadApplications();
            await loadSummary();
            showNotice('Application updated.');
        }));
        actions.append(status);
        addButton(actions, 'Delete application and resume', async () => {
            if (!window.confirm('Permanently delete this application and its private resume?')) return;
            await request(`/api/admin/applications/${item.id}`, { method: 'DELETE' });
            await loadApplications();
            await loadSummary();
            showNotice('Application and resume deleted.');
        }, 'button danger');
        card.append(actions);
        lists.applications.append(card);
    });
}

async function loadJobs() {
    const data = await request('/api/admin/jobs');
    lists.jobs.replaceChildren();
    if (!data.jobs.length) lists.jobs.append(node('p', 'empty', 'No listings yet.'));
    data.jobs.forEach(item => {
        const card = node('article', 'record');
        const heading = node('div', 'record-heading');
        heading.append(node('h3', '', item.title), node('span', 'badge', item.status));
        card.append(heading);
        const workMode = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' }[item.workMode] || item.workMode;
        const jobType = { full_time: 'Full-time', part_time: 'Part-time', internship: 'Internship', contract: 'Contract' }[item.jobType] || item.jobType;
        card.append(node('p', 'record-meta', [item.department, jobType, item.location, workMode, item.experienceLevel, item.deadline ? `Deadline ${item.deadline.slice(0, 10)}` : '', item.salaryRange, item.openings ? `${item.openings} openings` : ''].filter(Boolean).join(' · ')));
        card.append(node('p', 'record-message', item.description));
        if (item.responsibilities) card.append(node('p', 'record-message', `Responsibilities: ${item.responsibilities}`));
        if (item.qualifications) card.append(node('p', 'record-message', `Eligibility / qualifications: ${item.qualifications}`));
        if (item.skills.length) card.append(node('p', 'record-meta', `Skills: ${item.skills.join(', ')}`));
        const actions = node('div', 'record-actions');
        addButton(actions, 'Edit', () => populateJobForm(item));
        addButton(actions, item.status === 'published' ? 'Unpublish' : 'Publish', async () => {
            await request(`/api/admin/jobs/${item.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ ...item, deadline: item.deadline ? item.deadline.slice(0, 10) : '', status: item.status === 'published' ? 'draft' : 'published' })
            });
            await loadJobs();
            await loadSummary();
            showNotice('Listing visibility updated.');
        });
        if (item.status === 'published') addButton(actions, 'Close listing', async () => {
            await request(`/api/admin/jobs/${item.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ ...item, deadline: item.deadline ? item.deadline.slice(0, 10) : '', status: 'closed' })
            });
            await loadJobs();
            await loadSummary();
            showNotice('Listing closed.');
        });
        addButton(actions, 'Delete', async () => {
            if (!window.confirm('Delete this listing? Listings with applications must be unpublished instead.')) return;
            await request(`/api/admin/jobs/${item.id}`, { method: 'DELETE' });
            await loadJobs();
            showNotice('Listing deleted.');
        }, 'button danger');
        card.append(actions);
        lists.jobs.append(card);
    });
}

function populateJobForm(item) {
    const form = document.querySelector('#job-form');
    form.elements.id.value = item.id;
    form.elements.title.value = item.title;
    form.elements.department.value = item.department;
    form.elements.jobType.value = item.jobType;
    form.elements.experienceLevel.value = item.experienceLevel;
    form.elements.description.value = item.description;
    form.elements.responsibilities.value = item.responsibilities;
    form.elements.qualifications.value = item.qualifications;
    form.elements.skills.value = item.skills.join('\n');
    form.elements.location.value = item.location;
    form.elements.workMode.value = item.workMode;
    form.elements.deadline.value = item.deadline ? item.deadline.slice(0, 10) : '';
    form.elements.salaryRange.value = item.salaryRange || '';
    form.elements.openings.value = item.openings || '';
    form.elements.status.value = item.status;
    document.querySelector('#save-job').textContent = 'Save listing';
    document.querySelector('#cancel-job-edit').hidden = false;
    form.elements.title.focus();
}

function resetJobForm() {
    document.querySelector('#job-form').reset();
    document.querySelector('#job-form').elements.id.value = '';
    document.querySelector('#save-job').textContent = 'Create listing';
    document.querySelector('#cancel-job-edit').hidden = true;
}

async function loadActiveTab() {
    const loaders = { enquiries: loadEnquiries, applications: loadApplications, jobs: loadJobs };
    try {
        await loaders[activeTab]();
        await loadSummary();
    } catch (error) {
        showNotice(error.message, true);
    }
}

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(loginForm);
    try {
        const data = await request('/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ email: form.get('email'), password: form.get('password') })
        });
        loginForm.reset();
        showDashboard(data.email);
        showNotice('Signed in.');
        await loadActiveTab();
    } catch (error) {
        showNotice(error.message, true);
    }
});

logoutButton.addEventListener('click', async () => {
    try {
        await request('/api/admin/logout', { method: 'POST', body: '{}' });
        showLogin();
        showNotice('Signed out.');
    } catch (error) {
        showNotice(error.message, true);
    }
});

document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', async () => {
    activeTab = button.dataset.tab;
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab === button));
    document.querySelectorAll('.data-panel').forEach(panel => { panel.hidden = panel.id !== `${activeTab}-panel`; });
    showNotice('');
    await loadActiveTab();
}));

for (const [inputId, selectId] of [['enquiry-search', 'enquiry-status'], ['application-search', 'application-status']]) {
    document.querySelector(`#${inputId}`).addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            if (activeTab === (inputId.startsWith('enquiry') ? 'enquiries' : 'applications')) loadActiveTab();
        }, 200);
    });
    document.querySelector(`#${selectId}`).addEventListener('change', loadActiveTab);
}

document.querySelector('#job-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const job = {
        title: data.get('title'),
        department: data.get('department'),
        jobType: data.get('jobType'),
        description: data.get('description'),
        responsibilities: data.get('responsibilities'),
        qualifications: data.get('qualifications'),
        skills: data.get('skills').split(/\r?\n/).map(skill => skill.trim()).filter(Boolean),
        location: data.get('location'),
        workMode: data.get('workMode'),
        experienceLevel: data.get('experienceLevel'),
        salaryRange: data.get('salaryRange'),
        openings: data.get('openings'),
        deadline: data.get('deadline'),
        status: data.get('status')
    };
    const id = data.get('id');
    try {
        await request(id ? `/api/admin/jobs/${id}` : '/api/admin/jobs', {
            method: id ? 'PATCH' : 'POST',
            body: JSON.stringify(job)
        });
        resetJobForm();
        await loadJobs();
        await loadSummary();
        showNotice(id ? 'Listing updated.' : 'Listing created.');
    } catch (error) {
        showNotice(error.message, true);
    }
});

document.querySelector('#cancel-job-edit').addEventListener('click', resetJobForm);

request('/api/admin/session')
    .then(data => {
        showDashboard(data.email);
        return loadActiveTab();
    })
    .catch(() => showLogin());
