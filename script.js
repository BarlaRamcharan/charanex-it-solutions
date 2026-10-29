document.addEventListener('DOMContentLoaded', () => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (!location.hash || location.hash === '#home') scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const apiBaseValue = document.querySelector('meta[name="charanex-api-base"]')?.content.trim() || '';
    let apiBase = '';
    let apiBaseError = '';
    if (apiBaseValue) {
        try {
            const apiUrl = new URL(apiBaseValue);
            if (!['http:', 'https:'].includes(apiUrl.protocol) || apiUrl.pathname !== '/' || apiUrl.search || apiUrl.hash) {
                throw new Error();
            }
            apiBase = apiUrl.origin;
        } catch {
            apiBaseError = 'The backend URL is invalid. Configure charanex-api-base as the backend HTTPS origin.';
        }
    }
    const adminLoginLink = document.querySelector('#admin-login-link');
    if (adminLoginLink) {
        if (apiBase) {
            adminLoginLink.href = `${apiBase}/admin`;
            adminLoginLink.removeAttribute('aria-disabled');
            adminLoginLink.removeAttribute('title');
        } else {
            adminLoginLink.removeAttribute('href');
            adminLoginLink.setAttribute('aria-disabled', 'true');
            adminLoginLink.title = apiBaseError || 'Admin login is unavailable until the backend URL is configured.';
        }
    }
    const header = document.querySelector('.site-header');
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.site-nav');
    const topButton = document.querySelector('.top-button');
    const toast = document.querySelector('.toast');
    const founderImage = document.querySelector('.portrait-frame img');
    const showToast = message => { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3200); };
    founderImage.addEventListener('error', event => { event.currentTarget.style.display = 'none'; });
    if (founderImage.complete && founderImage.naturalWidth === 0) founderImage.style.display = 'none';
    const main = document.querySelector('#main-content');
    const orderedSections = ['home', 'about', 'services', 'solutions', 'web-showcase', 'why-charanex', 'industries', 'founder', 'leadership', 'careers', 'contact'].map(id => document.querySelector(`#${id}`) || document.querySelector(`.${id}`));
    const processSection = document.querySelector('.process')?.closest('section');
    const ctaSection = document.querySelector('.cta');
    main.append(...[...orderedSections.slice(0, 9), processSection, ctaSection, ...orderedSections.slice(9)].filter(Boolean));
    const closeMenu = () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); document.body.classList.remove('no-scroll'); };
    toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') === 'true'; toggle.setAttribute('aria-expanded', String(!open)); nav.classList.toggle('open', !open); document.body.classList.toggle('no-scroll', !open); });
    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', closeMenu));
    const sections = [...document.querySelectorAll('main section[id]')];
    const updateScroll = () => { header.classList.toggle('scrolled', scrollY > 24); topButton.classList.toggle('visible', scrollY > 600); let current = 'home'; sections.forEach(section => { if (scrollY + 150 >= section.offsetTop) current = section.id; }); document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.hash === `#${current}`)); };
    addEventListener('scroll', updateScroll, { passive: true }); updateScroll();
    topButton.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
    const industryDetails = {
        'Businesses & Startups': { overview: 'Digital technology solutions that help businesses and startups establish, improve and scale their digital operations.', needs: ['Professional websites', 'Custom software', 'Digital platforms', 'Business automation', 'B2B lead generation'], help: 'Provide practical web, software, IT and digital solutions based on business requirements.' },
        Education: { overview: 'Modern digital solutions for schools, colleges, training institutes and education-focused organizations.', needs: ['Educational websites', 'Student-facing platforms', 'Digital resources', 'Software solutions', 'Process automation'], help: 'Build modern digital experiences that support educational organizations and their technology needs.' },
        Healthcare: { overview: 'Digital experiences and software solutions designed around the needs of healthcare organizations.', needs: ['Healthcare websites', 'Digital information platforms', 'Appointment-related experiences', 'Business software', 'Process automation'], help: 'Create reliable and user-friendly digital solutions for healthcare organizations.' },
        Hospitality: { overview: 'Technology solutions for hotels, restaurants and hospitality businesses looking to strengthen their digital presence.', needs: ['Hotel websites', 'Restaurant websites', 'Digital experiences', 'Customer-facing platforms', 'Business automation'], help: 'Create polished digital experiences that represent hospitality brands professionally.' },
        'Real Estate': { overview: 'Digital platforms and technology solutions for real estate businesses and property-focused organizations.', needs: ['Real estate websites', 'Property listing experiences', 'Lead generation', 'Business software', 'Digital platforms'], help: 'Build modern digital experiences that help real estate organizations manage and present their online presence.' },
        'Retail & E-commerce': { overview: 'Modern web and software solutions that help retail businesses create stronger digital experiences.', needs: ['E-commerce websites', 'Product platforms', 'Business websites', 'Customer-facing experiences', 'Automation'], help: 'Develop scalable digital experiences for retail and online businesses.' }
    };
    const industryModal = document.createElement('div');
    industryModal.className = 'industry-modal';
    industryModal.id = 'industry-modal';
    industryModal.setAttribute('role', 'dialog');
    industryModal.setAttribute('aria-modal', 'true');
    industryModal.setAttribute('aria-labelledby', 'industry-modal-title');
    industryModal.setAttribute('aria-hidden', 'true');
    industryModal.innerHTML = '<div class="industry-modal-backdrop" data-industry-close></div><div class="industry-modal-panel" role="document"><button class="industry-modal-close" type="button" aria-label="Close industry details">×</button><div class="industry-modal-icon" aria-hidden="true"></div><span class="industry-modal-number"></span><h2 id="industry-modal-title"></h2><p class="industry-modal-overview"></p><h3>What you may need</h3><ul class="industry-modal-list"></ul><h3>How CharanEx can help</h3><p class="industry-modal-help"></p><a class="button primary industry-modal-contact" href="#contact">Let&#39;s Talk <span>↗</span></a></div>';
    document.body.append(industryModal);
    const industryModalTitle = industryModal.querySelector('#industry-modal-title');
    const industryModalNumber = industryModal.querySelector('.industry-modal-number');
    const industryModalIcon = industryModal.querySelector('.industry-modal-icon');
    const industryModalOverview = industryModal.querySelector('.industry-modal-overview');
    const industryModalList = industryModal.querySelector('.industry-modal-list');
    const industryModalHelp = industryModal.querySelector('.industry-modal-help');
    let lastIndustryTrigger;
    const closeIndustryModal = () => { industryModal.classList.remove('is-open'); industryModal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('no-scroll'); if (lastIndustryTrigger) lastIndustryTrigger.focus(); };
    const openIndustryModal = trigger => { const title = trigger.querySelector('h3').textContent.trim(); const detail = industryDetails[title]; if (!detail) return; lastIndustryTrigger = trigger; industryModalTitle.textContent = title; industryModalNumber.textContent = trigger.querySelector('.industry-number').textContent; industryModalIcon.innerHTML = trigger.querySelector('.industry-icon').innerHTML; industryModalOverview.textContent = detail.overview; industryModalList.innerHTML = detail.needs.map(need => `<li>${need}</li>`).join(''); industryModalHelp.textContent = detail.help; industryModal.classList.add('is-open'); industryModal.setAttribute('aria-hidden', 'false'); document.body.classList.add('no-scroll'); industryModal.querySelector('.industry-modal-close').focus(); };
    document.querySelectorAll('.industry-card').forEach(card => { const button = document.createElement('button'); button.type = 'button'; button.className = card.className; button.setAttribute('aria-label', `View ${card.querySelector('h3').textContent.trim()} details`); button.innerHTML = card.innerHTML; card.replaceWith(button); button.addEventListener('click', () => openIndustryModal(button)); });
    industryModal.querySelectorAll('[data-industry-close]').forEach(element => element.addEventListener('click', closeIndustryModal));
    industryModal.querySelector('.industry-modal-contact').addEventListener('click', closeIndustryModal);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && industryModal.classList.contains('is-open')) closeIndustryModal(); });
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }), { threshold: .12 });
    document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
    document.querySelectorAll('.showcase-image img').forEach(image => { const markUnavailable = () => image.closest('.showcase-image').classList.add('image-unavailable'); image.addEventListener('error', markUnavailable); if (image.complete && image.naturalWidth === 0) markUnavailable(); });
    const serviceModal = document.querySelector('#service-modal');
    const serviceModalTitle = serviceModal.querySelector('#service-modal-title');
    const serviceModalDescription = serviceModal.querySelector('.service-modal-description');
    const serviceModalList = serviceModal.querySelector('.service-modal-list');
    const serviceModalContact = serviceModal.querySelector('.service-modal-contact');
    const serviceDetails = {
        'Web Development': {
            description: 'Modern, responsive and high-performance websites designed to help businesses and organizations build a strong digital presence.',
            points: ['Responsive Website Development', 'Business Websites', 'Corporate Websites', 'Landing Pages', 'Portfolio Websites', 'Modern UI/UX', 'Mobile-first development', 'Performance optimization', 'SEO-friendly structure', 'Website maintenance']
        },
        'Software Solutions': {
            description: 'Custom software solutions designed around real business requirements, workflows and operational needs.',
            points: ['Custom Software Development', 'Business Management Systems', 'Internal Tools', 'Web Applications', 'Database-driven Applications', 'Workflow Systems', 'Automation', 'Scalable architecture', 'Maintenance and improvements']
        },
        'IT Solutions': {
            description: 'Practical technology solutions that help organizations improve efficiency, productivity and digital operations.',
            points: ['Technology Consulting', 'Business IT Solutions', 'Digital Infrastructure', 'System Integration', 'Technical Support', 'Productivity Solutions', 'Security-focused practices', 'Technology modernization']
        },
        'Digital Transformation': {
            description: 'Helping organizations modernize workflows, platforms and digital experiences through practical technology.',
            points: ['Digital strategy', 'Process modernization', 'Workflow automation', 'Cloud-ready solutions', 'Digital platforms', 'Data-driven workflows', 'Legacy modernization', 'Technology adoption']
        },
        'B2B Lead Generation': {
            description: 'Helping businesses identify relevant prospects and create structured B2B lead generation opportunities.',
            points: ['B2B Prospect Research', 'Lead Identification', 'Industry-based Lead Lists', 'Business Data Research', 'Target Account Research', 'Lead Qualification', 'Outreach-ready data', 'Structured lead generation sheets', 'Target industries: Schools, Colleges, Hospitals, Clinics, Coaching Centers, Restaurants, Hotels, Retail Stores, Real Estate Agencies and other businesses']
        },
        'Professional Education Consultancy': {
            description: 'Technology-focused education and career guidance for students and professionals.',
            points: ['Technology-focused education guidance', 'Student guidance', 'Professional learning guidance', 'Skill development direction', 'Technology career awareness', 'Digital learning solutions', 'Education technology consulting']
        }
    };
    let lastServiceTrigger;
    const closeServiceModal = () => { serviceModal.classList.remove('is-open'); serviceModal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('no-scroll'); if (lastServiceTrigger) lastServiceTrigger.focus(); };
    document.querySelectorAll('[data-service]').forEach(button => button.addEventListener('click', () => { const service = serviceDetails[button.dataset.service]; if (!service) return; lastServiceTrigger = button; serviceModalTitle.textContent = button.dataset.service; serviceModalDescription.textContent = service.description; serviceModalList.innerHTML = service.points.map(point => `<li>${point}</li>`).join(''); serviceModal.classList.add('is-open'); serviceModal.setAttribute('aria-hidden', 'false'); document.body.classList.add('no-scroll'); serviceModal.querySelector('.service-modal-close').focus(); }));
    serviceModal.querySelectorAll('[data-service-close]').forEach(element => element.addEventListener('click', closeServiceModal));
    serviceModalContact.addEventListener('click', () => { prefillServiceOfInterest(serviceModalTitle.textContent); closeServiceModal(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && serviceModal.classList.contains('is-open')) closeServiceModal(); });
    const solutionModal = document.querySelector('#solution-modal');
    const solutionModalTitle = solutionModal.querySelector('#solution-modal-title');
    const solutionModalNumber = solutionModal.querySelector('.solution-modal-number');
    const solutionModalDescription = solutionModal.querySelector('.solution-modal-description');
    const solutionModalOverview = solutionModal.querySelector('.solution-modal-overview-text');
    const solutionModalList = solutionModal.querySelector('.solution-modal-list');
    const solutionModalBenefits = solutionModal.querySelector('.solution-modal-benefits');
    const solutionModalContact = solutionModal.querySelector('.solution-modal-contact');
    const solutionDetails = {
        'Business Solutions': { description: 'Digital systems and technology solutions designed to bring clarity, efficiency and growth to business operations.', overview: 'We help businesses turn scattered processes into connected, practical systems that make day-to-day work easier to understand, manage and improve.', capabilities: ['Business process improvement', 'Digital workflow solutions', 'B2B solutions', 'Customer-facing platforms', 'Business data organization', 'Lead management', 'Operational tools', 'Productivity solutions', 'Business automation'], benefits: ['Improve operational efficiency', 'Reduce repetitive work', 'Organize business processes', 'Support better decision making', 'Enable digital growth'] },
        'Education Solutions': { description: 'Thoughtful technology experiences designed for students, educators, institutions and modern learning environments.', overview: 'We shape accessible digital experiences that support communication, learning resources and more connected education workflows.', capabilities: ['Educational websites', 'Student platforms', 'Learning management concepts', 'Digital resources', 'Institution portals', 'Student engagement tools', 'Education technology consulting', 'Digital learning experiences'], benefits: ['Better student experience', 'Easier access to resources', 'Improved digital communication', 'Modern learning workflows'] },
        'Digital Platforms': { description: 'Scalable online platforms that connect people, services, information and opportunities.', overview: 'We create platform concepts and digital products with clear user journeys, responsive interfaces and foundations that can grow with demand.', capabilities: ['Web platforms', 'Customer portals', 'Business portals', 'Online service platforms', 'User dashboards', 'Database-driven platforms', 'Responsive interfaces', 'Scalable architecture'], benefits: ['Centralized digital experience', 'Better accessibility', 'Scalable platform structure', 'Improved user engagement'] },
        'Automation Solutions': { description: 'Smarter workflows that reduce repetitive work, improve efficiency and give teams more time to focus on important tasks.', overview: 'We identify repetitive handoffs and design streamlined workflows that connect forms, data, notifications and operational steps.', capabilities: ['Workflow automation', 'Form automation', 'Data processing', 'Notifications', 'Lead automation', 'Repetitive task automation', 'Business process automation', 'Integration workflows'], benefits: ['Save time', 'Reduce manual errors', 'Improve productivity', 'Streamline operations'] },
        'Technology Consulting': { description: 'Clear technical direction for technology decisions that shape your next stage of growth.', overview: 'We bring structured thinking to technology choices, helping teams move from uncertainty to a practical roadmap they can act on.', capabilities: ['Technology strategy', 'Solution planning', 'Digital transformation guidance', 'Architecture planning', 'Technology evaluation', 'Software planning', 'AI and emerging technology exploration', 'Technical roadmap'], benefits: ['Better technology decisions', 'Reduced implementation risk', 'Clear technical direction', 'Practical technology planning'] },
        'Custom Software': { description: 'Purpose-built software designed around your processes, people and specific business requirements.', overview: 'We design software around the way your organization actually works, balancing useful functionality today with a foundation for future improvements.', capabilities: ['Custom web applications', 'Business management systems', 'Internal tools', 'Database applications', 'Dashboards', 'Workflow systems', 'API integrations', 'Scalable software architecture', 'Maintenance and enhancements'], benefits: ['Built around actual requirements', 'Flexible functionality', 'Scalable architecture', 'Better workflow efficiency'] }
    };
    let lastSolutionTrigger;
    const closeSolutionModal = () => { solutionModal.classList.remove('is-open'); solutionModal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('no-scroll'); if (lastSolutionTrigger) lastSolutionTrigger.focus(); };
    const openSolutionModal = trigger => { const solution = solutionDetails[trigger.dataset.solution]; if (!solution) return; lastSolutionTrigger = trigger; solutionModalNumber.textContent = trigger.querySelector('span').textContent; solutionModalTitle.textContent = trigger.dataset.solution; solutionModalDescription.textContent = solution.description; solutionModalOverview.textContent = solution.overview; solutionModalList.innerHTML = solution.capabilities.map(item => `<li>${item}</li>`).join(''); solutionModalBenefits.innerHTML = solution.benefits.map(item => `<li>${item}</li>`).join(''); solutionModal.classList.add('is-open'); solutionModal.setAttribute('aria-hidden', 'false'); document.body.classList.add('no-scroll'); solutionModal.querySelector('.solution-modal-close').focus(); };
    document.querySelectorAll('[data-solution]').forEach(item => { item.addEventListener('click', () => openSolutionModal(item)); item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openSolutionModal(item); } }); });
    solutionModal.querySelectorAll('[data-solution-close]').forEach(element => element.addEventListener('click', closeSolutionModal));
    solutionModalContact.addEventListener('click', () => { prefillServiceOfInterest(solutionModalTitle.textContent); closeSolutionModal(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && solutionModal.classList.contains('is-open')) closeSolutionModal(); });
    const prefillServiceOfInterest = service => {
        const field = document.querySelector('#contact-form [name="serviceOfInterest"]');
        if (field && [...field.options].some(option => option.value === service)) field.value = service;
    };
    const form = document.querySelector('#contact-form');
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phone = /^\+?[\d\s().-]{7,30}$/;
    const setError = (field, message) => {
        const help = field.parentElement.querySelector('small');
        if (help) help.textContent = message;
        field.setAttribute('aria-invalid', message ? 'true' : 'false');
    };
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const data = new FormData(form);
        const fields = {
            name: form.elements.name,
            email: form.elements.email,
            phone: form.elements.phone,
            company: form.elements.company,
            serviceOfInterest: form.elements.serviceOfInterest,
            message: form.elements.message
        };
        Object.values(fields).forEach(field => setError(field, ''));
        const status = form.querySelector('.form-status');
        status.className = 'form-status';
        status.textContent = '';
        let valid = true;
        if (!data.get('name').trim()) { setError(fields.name, 'Please enter your name.'); valid = false; }
        if (!email.test(data.get('email').trim())) { setError(fields.email, 'Please enter a valid email.'); valid = false; }
        if (data.get('phone').trim() && !phone.test(data.get('phone').trim())) { setError(fields.phone, 'Please enter a valid phone number.'); valid = false; }
        if (!data.get('serviceOfInterest').trim()) { setError(fields.serviceOfInterest, 'Choose a service of interest.'); valid = false; }
        if (!data.get('message').trim()) { setError(fields.message, 'Please tell us about your requirements.'); valid = false; }
        if (!valid) {
            status.textContent = 'Please review the highlighted fields.';
            status.classList.add('error');
            return;
        }
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        submit.setAttribute('aria-busy', 'true');
        try {
            const response = await fetch(`${apiBase}/api/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(data.entries()))
            });
            let result;
            try {
                result = await response.json();
            } catch {
                throw new Error('The server returned an invalid response.');
            }
            if (!response.ok) {
                if (result.fields) {
                    Object.entries(result.fields).forEach(([name, message]) => {
                        if (fields[name]) setError(fields[name], message);
                    });
                }
                throw new Error(result.error || 'Your enquiry could not be sent. Please try again.');
            }
            form.reset();
            status.textContent = result.message || 'Your enquiry has been received.';
            status.classList.add('success');
        } catch (error) {
            status.textContent = error.message || 'The service is temporarily unavailable. Please try again later.';
            status.classList.add('error');
        } finally {
            submit.disabled = false;
            submit.removeAttribute('aria-busy');
        }
    });

    const careerListings = document.querySelector('#career-listings');
    const applicationForm = document.querySelector('#application-form');
    const applicationStatus = applicationForm.querySelector('.application-status');
    const roleSelect = applicationForm.elements.jobId;
    const createSubmissionId = () => {
        if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    };
    applicationForm.elements.submissionId.value = createSubmissionId();
    const renderCareers = jobs => {
        careerListings.replaceChildren();
        roleSelect.replaceChildren(new Option('Select a current opportunity', ''));
        if (!jobs.length) {
            careerListings.append(Object.assign(document.createElement('p'), {
                className: 'career-status',
                textContent: 'There are no current opportunities listed. Please check back soon.'
            }));
            return;
        }
        jobs.forEach(job => {
            const card = document.createElement('article');
            card.className = 'career-card reveal visible';
            const title = document.createElement('h3');
            title.textContent = job.title;
            const openBadge = document.createElement('span');
            openBadge.className = 'career-open-badge';
            openBadge.textContent = 'Open';
            const department = document.createElement('p');
            department.className = 'career-meta';
            const jobType = { full_time: 'Full-time', part_time: 'Part-time', internship: 'Internship', contract: 'Contract' }[job.jobType] || job.jobType;
            const workMode = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' }[job.workMode] || job.workMode;
            department.textContent = [job.department, jobType, workMode, job.location, job.experienceLevel].filter(Boolean).join(' | ');
            const description = document.createElement('p');
            description.textContent = job.description;
            const titleRow = document.createElement('div');
            titleRow.className = 'career-title-row';
            titleRow.append(title, openBadge);
            card.append(titleRow, department, description);
            const details = document.createElement('details');
            details.className = 'career-details';
            const detailsSummary = document.createElement('summary');
            detailsSummary.textContent = 'Responsibilities, qualifications and other details';
            details.append(detailsSummary);
            for (const [label, value] of [
                ['Responsibilities', job.responsibilities],
                ['Eligibility / qualifications', job.qualifications]
            ]) {
                if (!value) continue;
                const heading = document.createElement('h4');
                heading.textContent = label;
                const paragraph = document.createElement('p');
                paragraph.textContent = value;
                details.append(heading, paragraph);
            }
            const extras = [
                job.salaryRange && `Compensation: ${job.salaryRange}`,
                job.openings && `Openings: ${job.openings}`,
                job.deadline && `Application deadline: ${job.deadline.slice(0, 10)}`
            ].filter(Boolean);
            if (extras.length) {
                const extraInfo = document.createElement('p');
                extraInfo.textContent = extras.join(' | ');
                details.append(extraInfo);
            }
            card.append(details);
            if (job.skills.length) {
                const skills = document.createElement('ul');
                skills.className = 'career-skills';
                job.skills.forEach(skill => {
                    const item = document.createElement('li');
                    item.textContent = skill;
                    skills.append(item);
                });
                card.append(skills);
            }
            const apply = document.createElement('button');
            apply.className = 'text-link career-apply';
            apply.type = 'button';
            apply.textContent = 'Apply Now';
            apply.addEventListener('click', () => {
                roleSelect.value = String(job.id);
                applicationForm.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
                roleSelect.focus({ preventScroll: true });
            });
            card.append(apply);
            careerListings.append(card);
            roleSelect.append(new Option(job.title, String(job.id)));
        });
    };
    const loadCareers = async () => {
        const showStatus = (message, className = 'career-status') => {
            careerListings.replaceChildren(Object.assign(document.createElement('p'), {
                className,
                role: 'status',
                textContent: message
            }));
        };
        if (apiBaseError) {
            showStatus(apiBaseError, 'career-status error');
            return;
        }
        if (!apiBase) {
            showStatus('Development preview: careers are not connected because the backend URL has not been configured.');
            return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(`${apiBase}/api/jobs`, { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`The careers API returned HTTP ${response.status}. Check the backend URL and deployment.`);
            }
            if (!response.headers.get('content-type')?.includes('application/json')) {
                throw new Error('The careers API returned a non-JSON response. Check that the backend URL points to the API service.');
            }
            let data;
            try {
                data = await response.json();
            } catch {
                throw new Error('The careers API returned invalid JSON.');
            }
            if (!data || !Array.isArray(data.jobs) || data.jobs.some(job => (
                !job
                || !['string', 'number'].includes(typeof job.id)
                || typeof job.title !== 'string'
                || typeof job.department !== 'string'
                || typeof job.jobType !== 'string'
                || typeof job.description !== 'string'
                || typeof job.location !== 'string'
                || typeof job.workMode !== 'string'
                || !Array.isArray(job.skills)
            ))) {
                throw new Error('The careers API returned an unexpected response format.');
            }
            renderCareers(data.jobs);
        } catch (error) {
            const message = error.name === 'AbortError'
                ? 'The careers API timed out. Check that the backend is running.'
                : error instanceof TypeError
                    ? `Cannot reach the careers backend at ${apiBase}. Check that it is available and allows this site in FRONTEND_ORIGIN.`
                    : error.message;
            showStatus(message || 'The careers service is unavailable.', 'career-status error');
        } finally {
            clearTimeout(timeout);
        }
    };
    applicationForm.addEventListener('submit', async event => {
        event.preventDefault();
        applicationStatus.className = 'application-status';
        applicationStatus.textContent = '';
        if (apiBaseError || !apiBase) {
            applicationStatus.textContent = apiBaseError || 'Development preview: applications cannot be submitted until the backend URL is configured.';
            applicationStatus.classList.add('error');
            return;
        }
        const applicationFields = ['jobId', 'name', 'email', 'phone', 'education', 'experienceLevel', 'relevantSkills', 'linkedinUrl', 'portfolioUrl', 'coverLetter', 'resume'];
        applicationFields.forEach(name => setError(applicationForm.elements[name], ''));
        const file = applicationForm.elements.resume.files[0];
        const values = Object.fromEntries(new FormData(applicationForm).entries());
        const setApplicationError = (field, message) => setError(applicationForm.elements[field], message);
        let valid = true;
        const requireValue = (field, message) => {
            if (!String(values[field] || '').trim()) {
                setApplicationError(field, message);
                valid = false;
            }
        };
        requireValue('jobId', 'Select a current opportunity.');
        requireValue('name', 'Enter your full name.');
        if (!email.test(String(values.email || '').trim())) { setApplicationError('email', 'Enter a valid email address.'); valid = false; }
        if (!phone.test(String(values.phone || '').trim())) { setApplicationError('phone', 'Enter a valid phone number.'); valid = false; }
        requireValue('education', 'Enter your current education or qualification.');
        requireValue('experienceLevel', 'Select your experience level.');
        requireValue('relevantSkills', 'List your relevant skills.');
        requireValue('coverLetter', 'Add a cover letter.');
        for (const field of ['linkedinUrl', 'portfolioUrl']) {
            const value = String(values[field] || '').trim();
            if (value) {
                try {
                    const url = new URL(value);
                    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw new Error();
                } catch {
                    setApplicationError(field, 'Enter a valid web URL.');
                    valid = false;
                }
            }
        }
        if (!file) {
            setApplicationError('resume', 'Attach a PDF or DOCX resume.');
            valid = false;
        } else if (!/\.(pdf|docx)$/i.test(file.name) || file.size === 0 || file.size > 5 * 1024 * 1024) {
            setApplicationError('resume', 'Use a non-empty PDF or DOCX resume up to 5 MB.');
            valid = false;
        }
        if (!valid) {
            applicationStatus.textContent = 'Please review the highlighted fields.';
            applicationStatus.classList.add('error');
            return;
        }
        const submit = applicationForm.querySelector('[type="submit"]');
        submit.disabled = true;
        submit.setAttribute('aria-busy', 'true');
        try {
            const response = await fetch(`${apiBase}/api/applications`, { method: 'POST', body: new FormData(applicationForm) });
            let result;
            try {
                result = await response.json();
            } catch {
                throw new Error('The server returned an invalid response.');
            }
            if (!response.ok) {
                if (result.fields) {
                    Object.entries(result.fields).forEach(([name, message]) => {
                        if (applicationFields.includes(name)) setApplicationError(name, message);
                    });
                }
                throw new Error(result.error || 'Your application could not be submitted. Please try again.');
            }
            applicationForm.reset();
            applicationForm.elements.submissionId.value = createSubmissionId();
            applicationStatus.textContent = result.message || 'Your application has been received.';
            applicationStatus.classList.add('success');
        } catch (error) {
            applicationStatus.textContent = error.message || 'The service is temporarily unavailable. Please try again later.';
            applicationStatus.classList.add('error');
        } finally {
            submit.disabled = false;
            submit.removeAttribute('aria-busy');
        }
    });
    loadCareers();
});