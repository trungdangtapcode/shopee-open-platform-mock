import { execFile } from "child_process";
import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { computeHmacSignature, RequestLogger, SchemaRegistry, ts } from "../utils";
import { BaseManager } from "./base.manager";

export class ConsoleManager extends BaseManager {
  constructor(
    config: ShopeeMockConfig,
    storage: StateStorage,
    private readonly schemaRegistry: SchemaRegistry,
    private readonly requestLogger: RequestLogger
  ) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get("/console", this.renderConsolePage.bind(this));
    this.router.get("/api/console/meta", this.getMeta.bind(this));
    this.router.post("/api/console/sign", this.signRequest.bind(this));
    this.router.post("/api/console/run-python-tests", this.runPythonTests.bind(this));
    this.router.post("/api/console/clear-logs", this.clearLogs.bind(this));
  }

  public renderConsolePage(_req: Request, res: Response): void {
    const htmlPath = path.join(this.config.publicDir, "console.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(fs.readFileSync(htmlPath, "utf8"));
  }

  public getMeta(_req: Request, res: Response): void {
    const reg = this.schemaRegistry.load();
    res.json({
      config: {
        partner_id: Number(this.config.partnerId),
        partner_key: this.config.partnerKey,
        shop_id: Number(this.config.shopId),
        access_token: this.config.accessToken,
        refresh_token: this.config.refreshToken,
        strict_sig: this.config.strictSig,
      },
      shop: this.db.shop,
      stats: {
        total_schemas: reg.list.length,
        modules: reg.modules,
        orders_count: this.db.orders.length,
        products_count: this.db.products.length,
        vouchers_count: this.db.vouchers.length,
        discounts_count: this.db.discounts.length,
      },
      schemas: reg.list.map((s) => ({
        api_name: s.api_name,
        module: s.module,
        method: s.method,
        path: s.path,
        api_type: s.api_type,
        description: s.description,
        request_params: (s.params?.request_params || []).map((p) => ({
          name: p.name,
          type: p.type,
          required: p.required,
          sample: p.sample,
          description: p.description,
        })),
      })),
      recent_logs: this.requestLogger.getRecentLogs(),
    });
  }

  public signRequest(req: Request, res: Response): void {
    const {
      api_path = "/api/v2/shop/get_shop_info",
      timestamp = ts(),
      access_token = "",
      shop_id = "",
      merchant_id = "",
    } = req.body || {};
    const { baseString, expected } = computeHmacSignature(
      this.config,
      String(api_path),
      Number(timestamp),
      String(access_token),
      String(shop_id),
      String(merchant_id)
    );
    res.json({
      partner_id: Number(this.config.partnerId),
      timestamp: Number(timestamp),
      base_string: baseString,
      sign: expected,
    });
  }

  public runPythonTests(req: Request, res: Response): void {
    const pyScript = path.resolve(__dirname, "..", "..", "..", "python-shopee-sdk", "test_app.py");
    const host = req.headers.host || `localhost:${this.config.port}`;
    const env = {
      ...process.env,
      SHOPEE_BASE_URL: `http://${host}/api/v2`,
      SHOPEE_AUTH_URL: `http://${host}/auth`,
      SHOPEE_PARTNER_ID: String(this.config.partnerId),
      SHOPEE_PARTNER_KEY: String(this.config.partnerKey),
    };
    execFile("python3", [pyScript], { env, timeout: 15000 }, (err, stdout, stderr) => {
      res.json({
        ok: !err,
        exit_code: err ? (err as { code?: number }).code || 1 : 0,
        stdout: stdout || "",
        stderr: stderr || (err ? err.message : ""),
      });
    });
  }

  public clearLogs(_req: Request, res: Response): void {
    this.requestLogger.clear();
    res.json({ ok: true });
  }
}
