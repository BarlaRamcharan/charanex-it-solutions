ALTER TABLE enquiries
    ADD COLUMN service_of_interest TEXT NOT NULL DEFAULT 'General enquiry';

ALTER TABLE jobs
    ADD COLUMN department TEXT NOT NULL DEFAULT 'Technology',
    ADD COLUMN job_type TEXT NOT NULL DEFAULT 'internship'
        CHECK (job_type IN ('full_time', 'part_time', 'internship', 'contract')),
    ADD COLUMN experience_level TEXT NOT NULL DEFAULT 'Entry level',
    ADD COLUMN responsibilities TEXT NOT NULL DEFAULT '',
    ADD COLUMN qualifications TEXT NOT NULL DEFAULT '',
    ADD COLUMN salary_range TEXT,
    ADD COLUMN openings INTEGER CHECK (openings IS NULL OR openings > 0);

ALTER TABLE applications
    ADD COLUMN education TEXT NOT NULL DEFAULT '',
    ADD COLUMN experience_level TEXT NOT NULL DEFAULT 'Entry level',
    ADD COLUMN relevant_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN linkedin_url TEXT,
    ADD COLUMN portfolio_url TEXT,
    ADD COLUMN submission_id TEXT;

UPDATE applications SET status = 'selected' WHERE status = 'hired';

CREATE UNIQUE INDEX applications_submission_id_unique_idx
    ON applications (submission_id)
    WHERE submission_id IS NOT NULL;
