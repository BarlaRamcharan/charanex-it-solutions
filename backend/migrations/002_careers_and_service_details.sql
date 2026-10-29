ALTER TABLE enquiries
    ADD COLUMN service_of_interest TEXT NOT NULL DEFAULT 'General enquiry';

ALTER TABLE jobs ADD COLUMN department TEXT NOT NULL DEFAULT 'Technology';
ALTER TABLE jobs ADD COLUMN job_type TEXT NOT NULL DEFAULT 'internship'
    CHECK (job_type IN ('full_time', 'part_time', 'internship', 'contract'));
ALTER TABLE jobs ADD COLUMN experience_level TEXT NOT NULL DEFAULT 'Entry level';
ALTER TABLE jobs ADD COLUMN responsibilities TEXT NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN qualifications TEXT NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN salary_range TEXT;
ALTER TABLE jobs ADD COLUMN openings INTEGER CHECK (openings IS NULL OR openings > 0);

ALTER TABLE applications ADD COLUMN education TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN experience_level TEXT NOT NULL DEFAULT 'Entry level';
ALTER TABLE applications ADD COLUMN relevant_skills TEXT NOT NULL DEFAULT '[]';
ALTER TABLE applications ADD COLUMN linkedin_url TEXT;
ALTER TABLE applications ADD COLUMN portfolio_url TEXT;
ALTER TABLE applications ADD COLUMN submission_id TEXT;

UPDATE applications SET status = 'selected' WHERE status = 'hired';

CREATE UNIQUE INDEX IF NOT EXISTS applications_submission_id_unique_idx
    ON applications (submission_id);
