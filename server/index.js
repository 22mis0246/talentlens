import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import multer from 'multer';
import pg from 'pg';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { Pool } = pg;
const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPath = path.resolve(__dirname, '../dist');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined
});

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Required for secure cookies behind Render's proxy
app.set('trust proxy', 1);

app.use(session({
  name: 'talentlens.sid',
  secret: process.env.SESSION_SECRET || 'local-demo-only-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 500
  },
  fileFilter: (req, file, cb) =>
    cb(null, /\.(pdf|docx)$/i.test(file.originalname))
});

const query = async (text, params = []) => {
  const r = await pool.query(text, params);
  return r.rows;
};

const seed = async () => {
  await pool.query(
    await readFile(
      fileURLToPath(new URL('./schema.sql', import.meta.url)),
      'utf8'
    )
  );

  const n = await query(
    'SELECT COUNT(*)::int AS n FROM candidates'
  );

  if (n[0].n) return;

  const people = [
    ['CND-91022', 'Ritika Bansal', 'Senior Java Developer', 6.5, 'Java,Spring Boot,microservices', 60, 'Built Spring Boot microservices for high-volume banking workflows.'],
    ['CND-91047', 'Arjun Rawat', 'KYC Analyst', 3, 'KYC,AML checks,Excel', 30, 'Reviewed KYC documents and executed AML checks using Excel.'],
    ['CND-91088', 'Pooja Nair', 'Java Developer', 4, 'Java,Hibernate,REST APIs', 90, 'Developed Java services with Hibernate and REST APIs.'],
    ['CND-91104', 'Dev Mehta', 'Senior Java Engineer', 7, 'Java,Spring Boot,AWS,microservices', 45, 'Led Spring Boot microservices delivery for retail payments.'],
    ['CND-91131', 'Ananya Rao', 'Backend Engineer', 5.5, 'Java,Spring,REST APIs', 30, 'Built Java and Spring services with REST APIs.'],
    ['CND-91202', 'Kabir Shah', 'Python Developer', 6, 'Python,Django,SQL', 15, 'Designed Django platforms and SQL data pipelines.']
  ];

  for (const p of people) {
    await pool.query(
      `INSERT INTO candidates
      (id,name,role,experience,skills,notice,summary,resume_text,content_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT DO NOTHING`,
      [
        ...p,
        `Name: ${p[1]}
Current Role: ${p[2]}
Experience: ${p[3]} years
Skills: ${p[4]}
Notice: ${p[5]} days
Summary: ${p[6]}`,
        createHash('sha256').update(p[6]).digest('hex')
      ]
    );
  }

  await pool.query(`
    INSERT INTO jobs
    (id,title,client,location,min_exp,max_exp,skills,max_notice)
    VALUES
    (1,'Senior Java Developer','Northstar Bank','Noida',5,8,'Java,Spring Boot,microservices',60),
    (2,'KYC Analyst','Meridian Services','Noida',2,5,'KYC,AML checks,Excel',45)
    ON CONFLICT(id) DO NOTHING
  `);

  await pool.query(
    "SELECT setval(pg_get_serial_sequence('jobs','id'),(SELECT MAX(id) FROM jobs))"
  );

  await pool.query(`
    INSERT INTO submissions(job_id,candidate_id,status)
    VALUES(1,'CND-91022','Shortlisted')
    ON CONFLICT DO NOTHING
  `);
};

const requireRole = (role) => (req, res, next) => {
  if (!req.session.role)
    return res.status(401).json({ error: 'Sign in required' });

  if (role && req.session.role !== role)
    return res.status(403).json({ error: 'Not allowed for this role' });

  next();
};

const audit = async (actor, action, cid) =>
  query(
    'INSERT INTO audit(actor,action,candidate_id) VALUES($1,$2,$3)',
    [actor, action, cid]
  );

export function score(person, job) {
  const wanted = job.skills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const have = person.skills.split(',').map(s => s.trim().toLowerCase());
  const matched = wanted.filter(s => have.includes(s));

  const skill = Math.round(65 * matched.length / Math.max(wanted.length, 1));

  const exp = Number(person.experience);
  const min = Number(job.min_exp);
  const max = Number(job.max_exp);

  const expScore = min <= exp && exp <= max
    ? 25
    : Math.max(0, Math.round(
        25 - Math.abs(exp - Math.max(min, Math.min(max, exp))) * 8
      ));

  const notice = Number(person.notice);
  const cap = Number(job.max_notice);

  const noticeScore = notice <= cap
    ? 10
    : Math.max(0, Math.round(10 - (notice - cap) / 5));

  const source = (criterion, fallback) =>
    String(person.resume_text || '')
      .split(/\r?\n/)
      .find(line =>
        new RegExp('^\\s*' + criterion + '\\s*[:\\-]', 'i').test(line)
      ) || fallback;

  return {
    score: skill + expScore + noticeScore,
    evidence: [
      {
        criterion: 'Skills',
        quote: source('Skills', person.skills),
        detail: matched.length
          ? `Matched: ${matched.join(', ')}`
          : 'No required skill match found in profile.'
      },
      {
        criterion: 'Experience',
        quote: source('Experience', `${exp} years experience`),
        detail: `Target range: ${min}-${max} years`
      },
      {
        criterion: 'Notice',
        quote: source('Notice', `${notice} days notice`),
        detail: `Maximum: ${cap} days`
      }
    ]
  };
}

const getJob = async id =>
  (await query('SELECT * FROM jobs WHERE id=$1', [id]))[0];

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.post('/api/login', (req, res) => {
  const { role } = req.body || {};

  if (!['recruiter', 'client'].includes(role))
    return res.status(400).json({ error: 'Choose a valid role' });

  req.session.role = role;
  req.session.actor = `Demo ${role[0].toUpperCase() + role.slice(1)}`;

  res.json({ role, name: req.session.actor });
});

app.post('/api/logout', (req, res) =>
  req.session.destroy(() => res.json({ ok: true }))
);

app.get('/api/me', (req, res) =>
  res.json({
    role: req.session.role || null,
    name: req.session.actor || null
  })
);

app.get('/api/jobs', requireRole(), async (req, res) =>
  res.json(await query('SELECT * FROM jobs ORDER BY id'))
);

app.get('/api/candidates', requireRole('recruiter'), async (req, res) => {
  const job = await getJob(Number(req.query.job) || 1);

  if (!job)
    return res.status(404).json({ error: 'Requisition not found' });

  const data = await query(
    'SELECT id,name,role,experience,skills,notice,summary,consent,stage FROM candidates WHERE consent=TRUE ORDER BY id'
  );

  res.json(
    data.map(p => ({ ...p, ...score(p, job) }))
      .sort((a, b) => b.score - a.score)
  );
});

app.post('/api/candidates/:cid/view', requireRole('recruiter'), async (req, res) => {
  const found = await query(
    'SELECT resume_text FROM candidates WHERE id=$1 AND consent=TRUE',
    [req.params.cid]
  );

  if (!found.length)
    return res.status(404).json({ error: 'Candidate not found' });

  await audit(req.session.actor, 'viewed', req.params.cid);

  res.json({ resume_text: found[0].resume_text });
});

app.patch('/api/jobs/:id/scorecard', requireRole('recruiter'), async (req, res) => {
  const d = req.body || {};
  const title = String(d.title || '').trim();
  const skills = String(d.skills || '').trim();
  const min = Number(d.min_exp);
  const max = Number(d.max_exp);
  const notice = Number(d.max_notice);
  const ctc = String(d.ctc_range || '').trim().slice(0, 80);

  if (!title || title.length > 100 || !skills || skills.length > 500 ||
      !Number.isFinite(min) || !Number.isFinite(max) ||
      min < 0 || max < min ||
      !Number.isInteger(notice) || notice < 0 || notice > 365) {
    return res.status(400).json({
      error: 'Check title, skills, experience range and notice days'
    });
  }

  const rows = await query(
    'UPDATE jobs SET title=$1,skills=$2,min_exp=$3,max_exp=$4,max_notice=$5,ctc_range=$6 WHERE id=$7 RETURNING id',
    [title, skills, min, max, notice, ctc, req.params.id]
  );

  if (!rows.length)
    return res.status(404).json({ error: 'Requisition not found' });

  res.json({ ok: true });
});

const field = (text, label, def = '') => {
  const re = new RegExp(
    String.raw`(?:^|\n)\s*(?:${label})\s*[:\-]\s*([^\r\n]+)`,
    'i'
  );

  return (text.match(re)?.[1] || def).trim().slice(0, 160);
};

app.post('/api/upload', requireRole('recruiter'), upload.array('files', 500), async (req, res) => {
  const files = req.files || [];

  if (req.body?.consent_confirmed !== 'true')
    return res.status(400).json({ error: 'Confirm candidate consent before upload' });

  if (!files.length)
    return res.status(400).json({ error: 'Choose PDF or DOCX files (up to 500)' });

  let accepted = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const f of files) {
    try {
      const text = f.originalname.toLowerCase().endsWith('.pdf')
        ? (await pdfParse(f.buffer)).text
        : (await mammoth.extractRawText({ buffer: f.buffer })).value;

      if (!text.trim()) {
        skipped++;
        continue;
      }

      const digest = createHash('sha256').update(f.buffer).digest('hex');
      const id = field(text, 'Candidate ID', 'UP-' + digest.slice(0, 8).toUpperCase());
      const name = field(text, 'Name', path.parse(f.originalname).name);
      const role = field(text, 'Current Role|Role', 'Candidate');
      const skills = field(text, 'Skills', 'Skills pending review');
      const summary = 'Profile imported from CV; review parsed text and criterion evidence.';
      const exp = Number(field(text, 'Experience', '0').match(/[\d.]+/)?.[0] || 0);
      const notice = Number(field(text, 'Notice', '90').match(/\d+/)?.[0] || 90);

      const r = await query(
        `INSERT INTO candidates
        (id,name,role,experience,skills,notice,summary,resume_text,consent,content_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9)
        ON CONFLICT DO NOTHING RETURNING id`,
        [id, name, role, exp, skills, notice, summary, text.slice(0, 50000), digest]
      );

      if (r.length) {
        accepted++;
        await audit(req.session.actor, 'consent recorded', id);
      } else {
        duplicates++;
      }
    } catch {
      skipped++;
    }
  }

  res.json({ accepted, duplicates, skipped });
});

app.post('/api/submissions', requireRole('recruiter'), async (req, res) => {
  const { candidate_id, job_id = 1 } = req.body || {};

  if (typeof candidate_id !== 'string' || candidate_id.length > 40)
    return res.status(400).json({ error: 'Invalid candidate' });

  const ok = await query(
    `INSERT INTO submissions(job_id,candidate_id,status)
    SELECT $1,id,'Pending' FROM candidates
    WHERE id=$2 AND consent=TRUE
    ON CONFLICT DO NOTHING RETURNING candidate_id`,
    [job_id, candidate_id]
  );

  if (!ok.length)
    return res.status(404).json({ error: 'Candidate not found or already submitted' });

  await audit(req.session.actor, 'submitted', candidate_id);
  res.json({ ok: true });
});

app.get('/api/portal', requireRole('client'), async (req, res) => {
  const data = await query(
    `SELECT s.job_id,s.status,s.reason,s.interview_slot,
    p.id,p.role,p.experience,p.skills,p.notice,p.summary,j.title,j.client
    FROM submissions s
    JOIN candidates p ON s.candidate_id=p.id
    JOIN jobs j ON j.id=s.job_id
    WHERE p.consent=TRUE AND j.client='Northstar Bank'
    ORDER BY p.id`
  );

  const jobs = await query('SELECT * FROM jobs');

  res.json(
    data.map(x => ({
      ...x,
      ...score(x, jobs.find(j => j.id === x.job_id))
    }))
  );
});

app.patch('/api/portal/:cid', requireRole('client'), async (req, res) => {
  const { status } = req.body || {};
  const reason = String(req.body?.reason || '').slice(0, 300);
  const slot = String(req.body?.slot || '').slice(0, 80);

  if (!['Shortlisted', 'Rejected', 'Interview proposed'].includes(status))
    return res.status(400).json({ error: 'Choose a valid action' });

  if (status === 'Rejected' && reason.trim().length < 3)
    return res.status(400).json({ error: 'Please add a short reason' });

  if (status === 'Interview proposed' && !slot)
    return res.status(400).json({ error: 'Choose an interview date and time' });

  const r = await query(
    `UPDATE submissions s
    SET status=$1,reason=$2,interview_slot=$3
    FROM jobs j
    WHERE s.job_id=j.id AND j.client='Northstar Bank'
    AND s.candidate_id=$4
    RETURNING s.candidate_id`,
    [status, reason, slot, req.params.cid]
  );

  if (!r.length)
    return res.status(404).json({ error: 'Candidate not found in your submissions' });

  await audit(req.session.actor, status, req.params.cid);
  res.json({ ok: true });
});

app.get('/api/pipeline', requireRole('recruiter'), async (req, res) =>
  res.json(await query(
    `SELECT p.id,p.name,p.role,p.experience,p.notice,p.stage,
    s.status,j.title FROM candidates p
    LEFT JOIN submissions s ON p.id=s.candidate_id
    LEFT JOIN jobs j ON j.id=s.job_id
    WHERE p.consent=TRUE ORDER BY p.id`
  ))
);

app.get('/api/audit', requireRole('recruiter'), async (req, res) =>
  res.json(await query(
    'SELECT actor,action,candidate_id,created_at FROM audit ORDER BY id DESC LIMIT 100'
  ))
);

app.post('/api/candidates/:cid/delete', requireRole('recruiter'), async (req, res) => {
  const cid = req.params.cid;

  await query('DELETE FROM submissions WHERE candidate_id=$1', [cid]);
  await query('DELETE FROM candidates WHERE id=$1', [cid]);
  await audit(req.session.actor, 'deletion requested', cid);

  res.json({ ok: true });
});

// Serve React frontend from the production build
app.use(express.static(frontendPath));

// React SPA fallback; preserve JSON responses for unknown API routes
app.get(/.*/, (req, res) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.code === 'LIMIT_FILE_SIZE'
        ? 'Each CV must be 8 MB or smaller.'
        : 'Upload must contain no more than 500 files.'
    });
  }

  console.error('Request failed', err.message);
  res.status(500).json({ error: 'Request failed. Please retry.' });
});

const port = Number(process.env.PORT) || 8000;

if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
  seed()
    .then(() => {
      app.listen(port, '0.0.0.0', () => {
        console.log(`TalentLens API listening on ${port}`);
      });
    })
    .catch(e => {
      console.error('Database startup failed', e.message);
      process.exit(1);
    });
}