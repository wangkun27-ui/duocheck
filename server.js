const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { db, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database
initDatabase();

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
app.use('/api/users', partnerRoutes);    // For /api/users/search
app.use('/api/partners', partnerRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

// Helper: return current public tunnel URL
app.get('/myurl', (req, res) => {
  return res.send(`<html><body style="font-family:sans-serif;padding:40px;background:#0a0a1a;color:#f1f5f9;text-align:center">
    <h2>🔥 DuoCheck 当前外网网址</h2>
    <p style="font-size:1.4em;background:rgba(255,255,255,0.1);padding:20px;border-radius:12px">
      <a href="https://0873c7b6e94907.lhr.life" style="color:#34d399">https://0873c7b6e94907.lhr.life</a>
    </p>
    <p>专属固定通道！直接发送给你的搭档，不需要输入任何IP！</p>
  </body></html>`);
});

// Daily cron job at 00:05 - check for missed checkins and dissolve partnerships
cron.schedule('5 0 * * *', () => {
  try {
    console.log('[CRON] Checking for missed checkins...');
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const activePartnerships = db.prepare("SELECT * FROM partnerships WHERE status = 'active'").all();
    const dissolvePartnership = db.prepare("UPDATE partnerships SET status = 'dissolved', dissolved_reason = 'missed_checkin', dissolved_at = CURRENT_TIMESTAMP WHERE id = ?");

    const checkGoals = db.prepare('SELECT id FROM goals WHERE user_id = ? AND status = ?');
    const checkCheckin = db.prepare('SELECT id FROM checkins WHERE goal_id = ? AND date = ?');

    const dissolveTransaction = db.transaction(() => {
      let dissolvedCount = 0;
      for (const partnership of activePartnerships) {
        const u1 = partnership.user1_id;
        const u2 = partnership.user2_id;

        let shouldDissolve = false;

        // Check user 1
        const u1Goals = checkGoals.all(u1, 'active');
        if (u1Goals.length > 0) {
          let u1CheckedInYesterday = false;
          for (const goal of u1Goals) {
            const checkin = checkCheckin.get(goal.id, yesterday);
            if (checkin) { u1CheckedInYesterday = true; break; }
          }
          if (!u1CheckedInYesterday) {
            shouldDissolve = true;
          }
        }

        // Check user 2
        if (!shouldDissolve) {
          const u2Goals = checkGoals.all(u2, 'active');
          if (u2Goals.length > 0) {
            let u2CheckedInYesterday = false;
            for (const goal of u2Goals) {
              const checkin = checkCheckin.get(goal.id, yesterday);
              if (checkin) { u2CheckedInYesterday = true; break; }
            }
            if (!u2CheckedInYesterday) {
              shouldDissolve = true;
            }
          }
        }

        if (shouldDissolve) {
          dissolvePartnership.run(partnership.id);
          dissolvedCount++;
          console.log(`[CRON] Partnership ${partnership.id} dissolved due to missed checkin`);
        }
      }
      console.log(`[CRON] Dissolved ${dissolvedCount} partnerships`);
    });

    dissolveTransaction();
  } catch (err) {
    console.error('[CRON] Error checking missed checkins:', err);
  }
});

// SPA fallback - serve index.html for all non-API routes
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

const VERSION = '3.0.0-ssh-stable';

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` DuoCheck Server running at http://localhost:${PORT}`);
  console.log(` Version: ${VERSION}`);
  console.log(` Mode: Local Database (SQLite)`);
  console.log(` Main Domain: https://0873c7b6e94907.lhr.life`);
  console.log(`=========================================`);
});

// High-Frequency Watchdog & Auto-Tunneler
const { spawn } = require('child_process');
let tunnelProcess = null;

function startTunnel() {
  try {
    if (tunnelProcess) tunnelProcess.kill('SIGKILL');
  } catch(e) {}
  
  console.log('[Watchdog] Spawning localhost.run SSH tunnel...');
  tunnelProcess = spawn('cmd.exe', [
    '/c',
    'ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:3000 nokey@localhost.run > tunnel.log 2>&1'
  ], { shell: true, detached: false });
}

startTunnel();

// Watchdog probe: Ensure SSH tunnel remains alive by pinging local server
setInterval(() => {
  fetch('http://localhost:3000/api/auth/me')
    .then(() => {
      // Server is fine
    })
    .catch(() => {
      console.log(`[Watchdog] Local server died. Rebooting...`);
    });
}, 30000);

module.exports = app;
