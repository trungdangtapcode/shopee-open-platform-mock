import express, { Express } from 'express';
import { requestLoggerMiddleware } from './middleware/request-logger';
import { registerAllRoutes } from './routes';
import { getSchemaRegistry } from './services/schema-loader.service';
import { loadState } from './store/database';

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  loadState();
  getSchemaRegistry();

  app.use(requestLoggerMiddleware);
  registerAllRoutes(app);

  return app;
}
