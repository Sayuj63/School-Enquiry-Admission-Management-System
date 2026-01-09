import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for development
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
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
    await connectDB();
    await seedDatabase();

    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  Server running on port ${PORT}`);
      console.log(`========================================`);
      console.log(`  API URL:      http://localhost:${PORT}`);
      console.log(`  Health:       http://localhost:${PORT}/health`);
      console.log(`  API Docs:     http://localhost:${PORT}/docs`);
      console.log(`  OpenAPI JSON: http://localhost:${PORT}/openapi.json`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
