import { NextFunction, Request, RequestHandler, Response } from "express";

export interface ApiRequestLogEntry {
  time: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  query: Record<string, unknown>;
}

export class RequestLogger {
  private readonly logs: ApiRequestLogEntry[] = [];

  constructor(private readonly maxEntries = 40) {}

  public getRecentLogs(): ApiRequestLogEntry[] {
    return this.logs;
  }

  public clear(): void {
    this.logs.length = 0;
  }

  public middleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (req.path.startsWith("/api/v2/")) {
        const started = Date.now();
        res.on("finish", () => {
          this.logs.unshift({
            time: new Date().toISOString().slice(11, 19),
            method: req.method,
            path: req.path,
            status: res.statusCode,
            ms: Date.now() - started,
            query: req.query as Record<string, unknown>,
          });
          if (this.logs.length > this.maxEntries) {
            this.logs.pop();
          }
        });
      }
      next();
    };
  }
}
