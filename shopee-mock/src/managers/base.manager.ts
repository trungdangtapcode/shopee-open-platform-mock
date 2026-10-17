import { RequestHandler, Router } from "express";
import { MockDatabase, ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { createRequireAuth } from "../utils";

export abstract class BaseManager {
  public readonly router: Router;
  protected readonly requireAuth: RequestHandler;

  constructor(
    protected readonly config: ShopeeMockConfig,
    protected readonly storage: StateStorage
  ) {
    this.router = Router();
    this.requireAuth = createRequireAuth(this.config);
  }

  protected get db(): MockDatabase {
    return this.storage.db;
  }
}
