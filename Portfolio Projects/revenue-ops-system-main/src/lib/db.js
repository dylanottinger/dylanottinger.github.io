import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'revenue_ops.db');

// Reuse connection across hot-reloads in Next.js dev mode
const db = globalThis._db ?? new Database(dbPath);
if (process.env.NODE_ENV !== 'production') globalThis._db = db;
db.pragma('journal_mode = WAL');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS reps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    territory TEXT NOT NULL,
    segment TEXT NOT NULL,
    capacity INTEGER DEFAULT 10,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    company TEXT,
    title TEXT,
    employees INTEGER,
    source TEXT,
    score INTEGER DEFAULT 0,
    rep_id TEXT,
    location TEXT,
    status TEXT DEFAULT 'Received',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    lead_id TEXT,
    event_type TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lead_id) REFERENCES leads(id)
  );

  CREATE TABLE IF NOT EXISTS exceptions (
    id TEXT PRIMARY KEY,
    lead_id TEXT,
    reason TEXT,
    status TEXT DEFAULT 'Open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lead_id) REFERENCES leads(id)
  );
`);

// Seed reps if empty
const countStmt = db.prepare('SELECT COUNT(*) as count FROM reps');
const { count } = countStmt.get();

if (count === 0) {
  const insertRep = db.prepare('INSERT INTO reps (id, name, territory, segment, capacity, active) VALUES (?, ?, ?, ?, ?, ?)');
  const reps = [
    { id: 'rep_1', name: 'Sarah O.', territory: 'US',   segment: 'Enterprise', capacity: 5,  active: 1 },
    { id: 'rep_2', name: 'John D.',  territory: 'US',   segment: 'SMB',        capacity: 15, active: 1 },
    { id: 'rep_3', name: 'Elena R.', territory: 'EMEA', segment: 'Enterprise', capacity: 5,  active: 1 },
    { id: 'rep_4', name: 'Mike T.',  territory: 'EMEA', segment: 'SMB',        capacity: 15, active: 1 },
    { id: 'rep_5', name: 'Wei L.',   territory: 'APAC', segment: 'Enterprise', capacity: 5,  active: 0 },
  ];

  const insertMany = db.transaction((reps) => {
    for (const rep of reps) {
      insertRep.run(rep.id, rep.name, rep.territory, rep.segment, rep.capacity, rep.active);
    }
  });
  insertMany(reps);
}

export default db;
