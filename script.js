document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.site-header');
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.site-nav');
    const topButton = document.querySelector('.top-button');
    const toast = document.querySelector('.toast');
    const founderImage = document.querySelector('.portrait-frame img');
    const showToast = message => { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3200); };
    founderImage.addEventListener('error', event => { event.currentTarget.style.display = 'none'; });
    if (founderImage.complete && founderImage.naturalWidth === 0) founderImage.style.display = 'none';
    const closeMenu = () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); document.body.classList.remove('no-scroll'); };
    toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') === 'true'; toggle.setAttribute('aria-expanded', String(!open)); nav.classList.toggle('open', !open); document.body.classList.toggle('no-scroll', !open); });
    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', closeMenu));
    const sections = [...document.querySelectorAll('main section[id]')];
    const updateScroll = () => { header.classList.toggle('scrolled', scrollY > 24); topButton.classList.toggle('visible', scrollY > 600); let current = 'home'; sections.forEach(section => { if (scrollY + 150 >= section.offsetTop) current = section.id; }); document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.hash === `#${current}`)); };
    addEventListener('scroll', updateScroll, { passive: true }); updateScroll();
    topButton.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
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
    serviceModalContact.addEventListener('click', closeServiceModal);
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
    solutionModalContact.addEventListener('click', closeSolutionModal);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && solutionModal.classList.contains('is-open')) closeSolutionModal(); });
    const form = document.querySelector('#contact-form');
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phone = /^[+\d][\d\s().-]{7,}$/;
    const setError = (field, message) => { const help = field.parentElement.querySelector('small'); if (help) help.textContent = message; field.setAttribute('aria-invalid', message ? 'true' : 'false'); };
    form.addEventListener('submit', event => { event.preventDefault(); const data = new FormData(form); const fields = { name: form.elements.name, email: form.elements.email, phone: form.elements.phone, subject: form.elements.subject, message: form.elements.message }; Object.values(fields).forEach(field => setError(field, '')); let valid = true; if (!data.get('name').trim()) { setError(fields.name, 'Please enter your name.'); valid = false; } if (!email.test(data.get('email').trim())) { setError(fields.email, 'Please enter a valid email.'); valid = false; } if (!data.get('phone').trim() || !phone.test(data.get('phone').trim())) { setError(fields.phone, 'Please enter a valid phone number.'); valid = false; } if (!data.get('subject').trim()) { setError(fields.subject, 'Please add a subject.'); valid = false; } if (!data.get('message').trim()) { setError(fields.message, 'Please tell us about your idea.'); valid = false; } const status = form.querySelector('.form-status'); status.className = 'form-status'; if (!valid) { status.textContent = 'Please review the highlighted fields.'; status.classList.add('error'); return; } const message = `Hello CharanEx IT Solutions,\n\nNew Website Enquiry\n\nName: ${data.get('name')}\nEmail: ${data.get('email')}\nPhone: ${data.get('phone')}\nCompany / Organization: ${data.get('company')}\nSubject: ${data.get('subject')}\n\nMessage:\n${data.get('message')}\n\nThank you.`; const whatsappURL = `https://wa.me/919392448939?text=${encodeURIComponent(message)}`; window.open(whatsappURL, '_blank'); status.textContent = 'Your WhatsApp message is ready to send.'; status.classList.add('success'); });
});