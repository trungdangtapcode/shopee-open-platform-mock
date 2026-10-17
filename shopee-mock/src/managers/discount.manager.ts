import { Request, Response } from "express";
import { DiscountRecord, ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { rid, ts } from "../utils";
import { BaseManager } from "./base.manager";

export class DiscountManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post("/add_discount", this.requireAuth, this.addDiscount.bind(this));
    this.router.get("/get_discount", this.requireAuth, this.getDiscount.bind(this));
    this.router.get("/get_discount_list", this.requireAuth, this.getDiscountList.bind(this));
    this.router.post("/update_discount", this.requireAuth, this.updateDiscount.bind(this));
    this.router.post("/delete_discount", this.requireAuth, this.deleteDiscount.bind(this));
    this.router.post("/end_discount", this.requireAuth, this.endDiscount.bind(this));
  }

  public addDiscount(req: Request, res: Response): void {
    const body = req.body || {};
    const discount_id = this.db.nextIds.discount++;
    const disc: DiscountRecord = {
      discount_id,
      discount_name: String(body.discount_name || "Mock Discount"),
      start_time: Number(body.start_time || ts() + 60),
      end_time: Number(body.end_time || ts() + 86400),
      status: "upcoming",
      item_list: [],
    };
    this.db.discounts.push(disc);
    this.storage.save();
    res.json({ error: "", message: "", request_id: rid(), response: { discount_id } });
  }

  public getDiscount(req: Request, res: Response): void {
    const id = Number(req.query.discount_id);
    const d = this.db.discounts.find((x) => x.discount_id === id) || {
      discount_id: id,
      discount_name: "Mock Discount",
      start_time: ts(),
      end_time: ts() + 86400,
      status: "upcoming",
      item_list: [],
      more: false,
    };
    res.json({ error: "", message: "", request_id: rid(), response: d });
  }

  public getDiscountList(_req: Request, res: Response): void {
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: { discount_list: this.db.discounts, more: false },
    });
  }

  public updateDiscount(req: Request, res: Response): void {
    const body = req.body || {};
    const d = this.db.discounts.find((x) => x.discount_id === Number(body.discount_id));
    if (d) {
      Object.assign(d, body);
      this.storage.save();
    }
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: { discount_id: Number(body.discount_id) },
    });
  }

  public deleteDiscount(req: Request, res: Response): void {
    const id = Number(req.body?.discount_id);
    const idx = this.db.discounts.findIndex((x) => x.discount_id === id);
    if (idx !== -1) {
      this.db.discounts.splice(idx, 1);
      this.storage.save();
    }
    res.json({ error: "", message: "", request_id: rid(), response: { discount_id: id } });
  }

  public endDiscount(req: Request, res: Response): void {
    const id = Number(req.body?.discount_id);
    res.json({ error: "", message: "", request_id: rid(), response: { discount_id: id } });
  }
}
