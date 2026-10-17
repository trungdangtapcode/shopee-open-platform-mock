import { Request, Response } from "express";
import { BundleDealRecord, ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { rid, ts } from "../utils";
import { BaseManager } from "./base.manager";

export class BundleDealManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post("/add_bundle_deal", this.requireAuth, this.addBundleDeal.bind(this));
    this.router.get("/get_bundle_deal", this.requireAuth, this.getBundleDeal.bind(this));
    this.router.get("/get_bundle_deal_list", this.requireAuth, this.getBundleDealList.bind(this));
    this.router.post("/update_bundle_deal", this.requireAuth, this.updateBundleDeal.bind(this));
    this.router.post("/delete_bundle_deal", this.requireAuth, this.deleteBundleDeal.bind(this));
    this.router.post("/end_bundle_deal", this.requireAuth, this.endBundleDeal.bind(this));
  }

  public addBundleDeal(req: Request, res: Response): void {
    const body = req.body || {};
    const bundle_deal_id = this.db.nextIds.bundleDeal++;
    const bd: BundleDealRecord = {
      bundle_deal_id,
      name: String(body.name || "Mock Bundle Deal"),
      start_time: Number(body.start_time || ts() + 60),
      end_time: Number(body.end_time || ts() + 86400),
      time_status: 2,
      bundle_deal_rule: {
        rule_type: Number(body.rule_type ?? 1),
        discount_value: Number(body.discount_value ?? 10),
        fix_price: Number(body.fix_price ?? 0),
        discount_percentage: Number(body.discount_percentage ?? 0),
        min_amount: Number(body.min_amount ?? 2),
      },
      purchase_limit: Number(body.purchase_limit ?? 5),
      item_list: [],
    };
    this.db.bundleDeals.push(bd);
    this.storage.save();
    res.json({ error: "", message: "", request_id: rid(), response: { bundle_deal_id } });
  }

  public getBundleDeal(req: Request, res: Response): void {
    const id = Number(req.query.bundle_deal_id);
    const bd = this.db.bundleDeals.find((x) => x.bundle_deal_id === id) || {
      bundle_deal_id: id,
      name: "Mock Bundle Deal",
      start_time: ts(),
      end_time: ts() + 86400,
      time_status: 2,
      bundle_deal_rule: { rule_type: 1, min_amount: 2, discount_value: 10 },
      purchase_limit: 5,
    };
    res.json({ error: "", message: "", request_id: rid(), response: bd });
  }

  public getBundleDealList(_req: Request, res: Response): void {
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: { bundle_deal_list: this.db.bundleDeals, more: false },
    });
  }

  public updateBundleDeal(req: Request, res: Response): void {
    const body = req.body || {};
    const bd = this.db.bundleDeals.find((x) => x.bundle_deal_id === Number(body.bundle_deal_id));
    if (bd) {
      if (body.name) bd.name = body.name;
      if (body.purchase_limit !== undefined) bd.purchase_limit = Number(body.purchase_limit);
      this.storage.save();
    }
    res.json({ error: "", message: "", request_id: rid(), response: bd || {} });
  }

  public deleteBundleDeal(req: Request, res: Response): void {
    const id = Number(req.body?.bundle_deal_id);
    const idx = this.db.bundleDeals.findIndex((x) => x.bundle_deal_id === id);
    if (idx !== -1) {
      this.db.bundleDeals.splice(idx, 1);
      this.storage.save();
    }
    res.json({ error: "", message: "", request_id: rid(), response: { bundle_deal_id: id } });
  }

  public endBundleDeal(req: Request, res: Response): void {
    const id = Number(req.body?.bundle_deal_id);
    res.json({ error: "", message: "", request_id: rid(), response: { bundle_deal_id: id } });
  }
}
