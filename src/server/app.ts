import express, { Express, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth';
import classesRouter from './routes/classes';
import subjectsRouter from './routes/subjects';
import { resourcesRouter } from './routes/resources';
import { papersRouter } from './routes/papers';
import { settingsRouter } from './routes/settings';
import { questionBankRouter } from './routes/questionBank';
import { backupRouter } from './routes/backup';

export function createExpressApp(): Express {
  const app = express();

  // Standard middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Teacher Exam & Class Management Portal (Phase 6 Production)',
    });
  });

  // Mount API routers
  app.use('/api/auth', authRouter);
  app.use('/api/classes', classesRouter);
  app.use('/api/subjects', subjectsRouter);
  app.use('/api/resources', resourcesRouter);
  app.use('/api/papers', papersRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/question-bank', questionBankRouter);
  app.use('/api/backup', backupRouter);

  // Central error handling middleware for API routes
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err.statusCode || err.status || 500;
    if (statusCode >= 500) {
      console.error('Unhandled Server Error:', err);
    }
    res.status(statusCode).json({
      error: err.message || 'An unexpected server error occurred',
      code: err.code || 'INTERNAL_SERVER_ERROR',
    });
  });

  return app;
}

export default createExpressApp;
