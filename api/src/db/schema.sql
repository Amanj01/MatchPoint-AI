-- MatchPoint AI schema (PostgreSQL). Safe to re-run.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('candidate', 'employer')),
  avatar_color  TEXT NOT NULL DEFAULT '#4f46e5',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id         SERIAL PRIMARY KEY,
  owner_id   INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  industry   TEXT NOT NULL DEFAULT '',
  size       TEXT NOT NULL DEFAULT '',
  location   TEXT NOT NULL DEFAULT '',
  website    TEXT NOT NULL DEFAULT '',
  about      TEXT NOT NULL DEFAULT '',
  color      TEXT NOT NULL DEFAULT '#0f766e',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- What the candidate types in. The AI agent turns this into a CV.
CREATE TABLE IF NOT EXISTS profiles (
  user_id          INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline         TEXT NOT NULL DEFAULT '',
  desired_role     TEXT NOT NULL DEFAULT '',
  location         TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL DEFAULT '',
  links            TEXT NOT NULL DEFAULT '',
  passion          TEXT NOT NULL DEFAULT '',
  years_experience NUMERIC(4,1) NOT NULL DEFAULT 0,
  skills           JSONB NOT NULL DEFAULT '[]',
  experience       JSONB NOT NULL DEFAULT '[]',
  education        JSONB NOT NULL DEFAULT '[]',
  projects         JSONB NOT NULL DEFAULT '[]',
  languages        JSONB NOT NULL DEFAULT '[]',
  open_to_work     BOOLEAN NOT NULL DEFAULT true,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The generated (and optionally hand-edited) CV.
CREATE TABLE IF NOT EXISTS cvs (
  user_id    INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  content    JSONB NOT NULL,
  template   TEXT NOT NULL DEFAULT 'modern',
  ai_mode    TEXT NOT NULL DEFAULT 'mock',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id               SERIAL PRIMARY KEY,
  company_id       INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  location         TEXT NOT NULL DEFAULT '',
  remote           BOOLEAN NOT NULL DEFAULT false,
  type             TEXT NOT NULL DEFAULT 'Full-time',
  level            TEXT NOT NULL DEFAULT 'junior' CHECK (level IN ('intern', 'junior', 'mid', 'senior')),
  salary_min       INT,
  salary_max       INT,
  currency         TEXT NOT NULL DEFAULT 'USD',
  description      TEXT NOT NULL DEFAULT '',
  responsibilities JSONB NOT NULL DEFAULT '[]',
  requirements     JSONB NOT NULL DEFAULT '[]',
  nice_to_have     JSONB NOT NULL DEFAULT '[]',
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  views            INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_company_idx ON jobs(company_id);

CREATE TABLE IF NOT EXISTS applications (
  id            SERIAL PRIMARY KEY,
  job_id        INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_letter  TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'applied'
                CHECK (status IN ('applied', 'shortlisted', 'interview', 'offer', 'hired', 'rejected')),
  match_score   INT NOT NULL DEFAULT 0,
  employer_note TEXT NOT NULL DEFAULT '',
  source        TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('direct', 'invited')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);
CREATE INDEX IF NOT EXISTS applications_user_idx ON applications(user_id);

-- Status history shown as a timeline to both sides.
CREATE TABLE IF NOT EXISTS application_events (
  id             SERIAL PRIMARY KEY,
  application_id INT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invites (
  job_id     INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_jobs (
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  link       TEXT NOT NULL DEFAULT '',
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, read);

-- Every AI call is logged (daily budget) and cached (repeat clicks are free).
CREATE TABLE IF NOT EXISTS ai_usage (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  kind       TEXT NOT NULL,
  mode       TEXT NOT NULL,
  cached     BOOLEAN NOT NULL DEFAULT false,
  tokens_in  INT NOT NULL DEFAULT 0,
  tokens_out INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_cache (
  key        TEXT PRIMARY KEY,
  result     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Photos (seeded demo data uses external portrait and office images)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cover_url TEXT;
