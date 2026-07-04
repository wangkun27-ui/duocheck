const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { db, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database
initDatabase()
  .then(() => {
    console.log('[DB] Database initialization complete.');
  })
  .catch((err) => {
    console.error('[DB] Database initialization failed:', err);
  });

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

// Import Routes
const authRoutes = require('./routes/auth');
const partnerRoutes = require('./routes/partners');
const goalRoutes = require('./routes/goals');
const checkinRoutes = require('./routes/checkins');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/users', partnerRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

// Daily cron job at 00:05 - check for missed checkins and dissolve partnerships
cron.schedule('5 0 * * *', async () => {
  try {
    console.log('[CRON] Checking for missed checkins...');
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const activePartnerships = await db.all("SELECT * FROM partnerships WHERE status = 'active'");

    await db.transaction(async (tx) => {
      let dissolvedCount = 0;
      for (const partnership of activePartnerships) {
        const u1 = partnership.user1_id;
        const u2 = partnership.user2_id;
        let shouldDissolve = false;

        const u1Goals = await tx.all("SELECT id FROM goals WHERE user_id = ? AND status = 'active'", [u1]);
        if (u1Goals.length > 0) {
          let u1CheckedIn = false;
          for (const goal of u1Goals) {
            const checkin = await tx.get('SELECT id FROM checkins WHERE goal_id = ? AND date = ?', [goal.id, yesterday]);
            if (checkin) { u1CheckedIn = true; break; }
          }
          if (!u1CheckedIn) shouldDissolve = true;
        }

        if (!shouldDissolve) {
          const u2Goals = await tx.all("SELECT id FROM goals WHERE user_id = ? AND status = 'active'", [u2]);
          if (u2Goals.length > 0) {
            let u2CheckedIn = false;
            for (const goal of u2Goals) {
              const checkin = await tx.get('SELECT id FROM checkins WHERE goal_id = ? AND date = ?', [goal.id, yesterday]);
              if (checkin) { u2CheckedIn = true; break; }
            }
            if (!u2CheckedIn) shouldDissolve = true;
          }
        }

        if (shouldDissolve) {
          await tx.run("UPDATE partnerships SET status = 'dissolved', dissolved_reason = 'missed_checkin', dissolved_at = CURRENT_TIMESTAMP WHERE id = ?", [partnership.id]);
          dissolvedCount++;
        }
      }
      console.log(`[CRON] Dissolved ${dissolvedCount} partnerships`);
    });
  } catch (err) {
    console.error('[CRON] Error:', err);
  }
});

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ success: false, error: 'Page not found' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

const VERSION = '4.0.0-cloud';

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` DuoCheck Server running on port ${PORT}`);
  console.log(` Version: ${VERSION}`);
  console.log(` Mode: ${db.isPg ? 'Cloud PostgreSQL' : 'Local SQLite'}`);
  console.log(`=========================================`);
});

module.exports = app;
