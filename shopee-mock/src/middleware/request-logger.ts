import { NextFunction, Request, Response } from 'express';
import { nowStr } from '../config/env';
import { DB } from '../store/database';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const fullPath = req.originalUrl.split('?')[0];
  if (fullPath.startsWith('/api/v2/')) {
    const start = Date.now();
    const origEnd = res.end;

    res.end = function (this: Response, ...args: unknown[]): Response {
      DB.apiLogs.unshift({
        id: 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        time: nowStr(),
        method: req.method,
        path: fullPath,
        status: res.statusCode,
        duration_ms: Date.now() - start,
        query: (req.query || {}) as Record<string, unknown>,
        body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
      });
      if (DB.apiLogs.length > 60) {
        DB.apiLogs.length = 60;
      }
      return (origEnd as Function).apply(this, args);
    } as typeof res.end;
  }
  next();
}
