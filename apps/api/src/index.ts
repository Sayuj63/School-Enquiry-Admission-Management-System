import './env';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import cors from 'cors';
import path from 'path';
import { apiReference } from '@scalar/express-api-reference';
import { connectDB } from './config/db';
import { seedDatabase } from './config/seed';
import { openApiSpec } from './openapi';

// Routes
import authRoutes from './routes/auth';
import enquiryRoutes from './routes/enquiry';
import admissionRoutes from './routes/admission';
import slotRoutes from './routes/slot';
import templateRoutes from './routes/template';
import otpRoutes from './routes/otp';
import settingsRoutes from './routes/settings';
import { startReminderJob } from './services/reminder';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5002;

// 1. CORS MUST be first to handle preflights and ensure headers are on all responses
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',')
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In development, allow any localhost origin
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');

    if (allowedOrigins.indexOf(origin) !== -1 || (process.env.NODE_ENV === 'development' && isLocalhost)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
}));

// 2. Helmet for security
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disabled for API docs flexibility, enable if needed
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV === 'development' ? 5000 : 100, // Higher limit in development
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests' }
});

// 3. Apply rate limiting to all requests (can also be applied to specific routes)
app.use('/api/', limiter);

// 4. Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Minimal health route for Render
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Detailed health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OpenAPI JSON endpoint
app.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

// Scalar API Reference Documentation
app.use(
  '/docs',
  apiReference({
    theme: 'purple',
    spec: {
      content: openApiSpec
    }
  })
);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/enquiry', enquiryRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/admission', admissionRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/settings', settingsRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Start server
async function startServer() {
  try {
    // Start listening as soon as possible to satisfy Render's health check
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n ========================================`);
      console.log(`  Server running on port ${PORT} `);
      console.log(`  Binding to 0.0.0.0`);
      console.log(`========================================`);
      console.log(`  API URL: http://localhost:${PORT}`);
      console.log(`  Health:       http://localhost:${PORT}/health`);
      console.log(`  Minimal:      http://localhost:${PORT}/`);
      console.log(`  API Docs:     http://localhost:${PORT}/docs`);
      console.log(`========================================\n`);
    });

    // Connect to DB and seed after starting the server
    // This prevents Render from killing the process if DB connection is slow
    await connectDB();
    await seedDatabase();

    // Start automated background tasks
    startReminderJob();

    console.log('Database connection and seeding complete.');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Closing server...');
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed during server startup sequence:', error);
    // We don't necessarily want to exit immediately if seeding fails but the server is up
    // However, if DB connection fails, the app might be useless.
    // For now, let's keep it running to allow debugging if needed, 
    // or exit if it's a critical failure.
    if (error instanceof Error && error.message.includes('MONGODB_URI')) {
      console.error('CRITICAL: MONGODB_URI missing. Exiting...');
      process.exit(1);
    }
  }
}

startServer();
