require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const { initDb } = require('./db/init');

// ── Validate required environment variables before anything else ──────────────
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';
const app = express();
const PORT = process.env.PORT || 4000;

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet());

// In production, FRONTEND_URL must be set; fall back to '*' only in dev
const corsOrigin = process.env.FRONTEND_URL || '*';
app.use(cors({ 
  origin: corsOrigin,
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// ── Health check (used by Railway healthcheckPath) ────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV })
);

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

// ── 404 handler for API routes ───────────────────────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Serve React Frontend ──────────────────────────────────────────────────────
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
// Suppress stack traces in production to avoid leaking internals
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: isProduction ? 'Internal server error' : (err.message || 'Internal server error'),
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
initDb()
  .then(() => {
    app.listen(PORT, () =>
      console.log(`[taskflow] API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`)
    );
  })
  .catch((err) => {
    console.error('[startup] DB init failed:', err.message);
    process.exit(1);
  });
