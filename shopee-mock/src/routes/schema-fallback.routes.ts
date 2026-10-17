import { NextFunction, Request, Response, Router } from 'express';
import { rid } from '../config/env';
import { requireAuth } from '../middleware/signature';
import { getSchemaRegistry } from '../services/schema-loader.service';

export const schemaFallbackRouter = Router();

schemaFallbackRouter.all('/api/v2/*', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  const { schemaMap } = getSchemaRegistry();
  const fullPath = req.originalUrl.split('?')[0];
  const spec = schemaMap.get(fullPath);
  if (!spec) {
    next();
    return;
  }
  const cloned = JSON.parse(JSON.stringify(spec.samplePayload));
  cloned.request_id = rid();
  cloned.error = '';
  cloned.message = '';
  res.json(cloned);
});

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'endpoint_not_found',
    message: `${req.method} ${req.path} is not implemented.`,
    request_id: rid(),
  });
}
