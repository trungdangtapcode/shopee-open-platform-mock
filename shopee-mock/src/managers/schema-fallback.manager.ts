import { Request, Response } from "express";
import { ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { buildResponseFromSchema, rid, SchemaRegistry, verifySignature } from "../utils";
import { BaseManager } from "./base.manager";

export class SchemaFallbackManager extends BaseManager {
  constructor(
    config: ShopeeMockConfig,
    storage: StateStorage,
    private readonly schemaRegistry: SchemaRegistry
  ) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.all("/api/v2/*", this.handleSchemaFallback.bind(this));
    this.router.use(this.handleNotFound.bind(this));
  }

  public handleSchemaFallback(req: Request, res: Response): void {
    if (!verifySignature(this.config, req, res)) return;
    const reg = this.schemaRegistry.load();
    const cleanPath = req.originalUrl.split("?")[0];
    const schema = reg.byPath.get(cleanPath);
    if (schema) {
      res.json(buildResponseFromSchema(schema));
      return;
    }
    res.json({ error: "", message: "", request_id: rid(), response: {} });
  }

  public handleNotFound(req: Request, res: Response): void {
    res.status(404).json({
      error: "endpoint_not_found",
      message: `No mock handler for ${req.method} ${req.path}`,
      request_id: rid(),
    });
  }
}
