require('dotenv').config();
const { Pool } = require('pg');
const path = require('path');

const databaseUrl = process.env.DATABASE_URL;
const isPg = !!databaseUrl;

let sqliteDb = null;
let pgPool = null;

if (isPg) {
  pgPool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
} else {
  // Only load better-sqlite3 when running locally (not on cloud)
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, 'duocheck.db');
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
}

function convertPlaceholder(sql) {
  let count = 1;
  return sql.replace(/\?/g, () => `$${count++}`);
}

const db = {
  isPg,
  sqliteDb,
  pgPool,

  async get(sql, params = []) {
    if (isPg) {
      const res = await pgPool.query(convertPlaceholder(sql), params);
      return res.rows[0] || null;
    } else {
      return sqliteDb.prepare(sql).get(...params) || null;
    }
  },

  async all(sql, params = []) {
    if (isPg) {
      const res = await pgPool.query(convertPlaceholder(sql), params);
      return res.rows;
    } else {
      return sqliteDb.prepare(sql).all(...params);
    }
  },

  async run(sql, params = []) {
    if (isPg) {
      let pgSql = convertPlaceholder(sql);
      if (pgSql.trim().toLowerCase().startsWith('insert')) {
        pgSql += ' RETURNING id';
      }
      const res = await pgPool.query(pgSql, params);
      const lastInsertRowid = res.rows[0] ? res.rows[0].id : null;
      return { lastInsertRowid };
    } else {
      const res = sqliteDb.prepare(sql).run(...params);
      return { lastInsertRowid: res.lastInsertRowid };
    }
  },

  async transaction(fn) {
    if (isPg) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const tx = {
          get: async (sql, params = []) => {
            const res = await client.query(convertPlaceholder(sql), params);
            return res.rows[0] || null;
          },
          all: async (sql, params = []) => {
            const res = await client.query(convertPlaceholder(sql), params);
            return res.rows;
          },
          run: async (sql, params = []) => {
            let pgSql = convertPlaceholder(sql);
            if (pgSql.trim().toLowerCase().startsWith('insert')) {
              pgSql += ' RETURNING id';
            }
            const res = await client.query(pgSql, params);
            return { lastInsertRowid: res.rows[0] ? res.rows[0].id : null };
          }
        };
        const result = await fn(tx);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      try {
        sqliteDb.prepare('BEGIN').run();
        const tx = {
          get: async (sql, params = []) => sqliteDb.prepare(sql).get(...params) || null,
          all: async (sql, params = []) => sqliteDb.prepare(sql).all(...params),
          run: async (sql, params = []) => {
            const res = sqliteDb.prepare(sql).run(...params);
            return { lastInsertRowid: res.lastInsertRowid };
          }
        };
        const result = await fn(tx);
        sqliteDb.prepare('COMMIT').run();
        return result;
      } catch (err) {
        try { sqliteDb.prepare('ROLLBACK').run(); } catch(e) {}
        throw err;
      }
    }
  }
};

async function initDatabase() {
  if (isPg) {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS partner_requests (
        id SERIAL PRIMARY KEY,
        from_user_id INTEGER NOT NULL REFERENCES users(id),
        to_user_id INTEGER NOT NULL REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS partnerships (
        id SERIAL PRIMARY KEY,
        user1_id INTEGER NOT NULL REFERENCES users(id),
        user2_id INTEGER NOT NULL REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'active',
        dissolved_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        dissolved_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS checkins (
        id SERIAL PRIMARY KEY,
        goal_id INTEGER NOT NULL REFERENCES goals(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        date VARCHAR(50) NOT NULL,
        note TEXT,
        images TEXT,
        verified_by INTEGER REFERENCES users(id),
        verified_status VARCHAR(50),
        verify_comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        partnership_id INTEGER NOT NULL REFERENCES partnerships(id),
        sender_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON checkins(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_checkins_goal_date ON checkins(goal_id, date);
      CREATE INDEX IF NOT EXISTS idx_partnerships_status ON partnerships(status);
      CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_messages_partnership ON messages(partnership_id);
      CREATE INDEX IF NOT EXISTS idx_partner_requests_to ON partner_requests(to_user_id, status);
    `);
  } else {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS partner_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users(id),
        FOREIGN KEY (to_user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS partnerships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user1_id INTEGER NOT NULL,
        user2_id INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        dissolved_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        dissolved_at DATETIME,
        FOREIGN KEY (user1_id) REFERENCES users(id),
        FOREIGN KEY (user2_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        note TEXT,
        images TEXT,
        verified_by INTEGER,
        verified_status TEXT,
        verify_comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (goal_id) REFERENCES goals(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (verified_by) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        partnership_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (partnership_id) REFERENCES partnerships(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON checkins(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_checkins_goal_date ON checkins(goal_id, date);
      CREATE INDEX IF NOT EXISTS idx_partnerships_status ON partnerships(status);
      CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_messages_partnership ON messages(partnership_id);
      CREATE INDEX IF NOT EXISTS idx_partner_requests_to ON partner_requests(to_user_id, status);
    `);
  }
}

module.exports = { db, initDatabase };
