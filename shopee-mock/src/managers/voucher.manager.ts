import { Request, Response } from "express";
import { ShopeeMockConfig, VoucherRecord } from "../schemas";
import { StateStorage } from "../storage";
import { rid, ts } from "../utils";
import { BaseManager } from "./base.manager";

export class VoucherManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post("/add_voucher", this.requireAuth, this.addVoucher.bind(this));
    this.router.get("/get_voucher", this.requireAuth, this.getVoucher.bind(this));
    this.router.get("/get_voucher_list", this.requireAuth, this.getVoucherList.bind(this));
    this.router.post("/update_voucher", this.requireAuth, this.updateVoucher.bind(this));
    this.router.post("/delete_voucher", this.requireAuth, this.deleteVoucher.bind(this));
    this.router.post("/end_voucher", this.requireAuth, this.endVoucher.bind(this));
  }

  public addVoucher(req: Request, res: Response): void {
    const body = req.body || {};
    const voucher_id = this.db.nextIds.voucher++;
    const voucher: VoucherRecord = {
      voucher_id,
      voucher_code: String(body.voucher_code || "MOCKV" + voucher_id),
      voucher_name: String(body.voucher_name || "Mock Voucher"),
      voucher_type: Number(body.voucher_type ?? 1),
      reward_type: Number(body.reward_type ?? 1),
      usage_quantity: Number(body.usage_quantity ?? 100),
      current_usage: 0,
      start_time: Number(body.start_time || ts() + 60),
      end_time: Number(body.end_time || ts() + 86400),
      is_admin: false,
      voucher_purpose: 0,
      discount_amount: Number(body.discount_amount || 10),
      percentage: Number(body.percentage || 0),
      max_price: Number(body.max_price || 0),
      min_basket_price: Number(body.min_basket_price || 50),
      display_channel_list: body.display_channel_list || [1],
      display_start_time: Number(body.display_start_time || body.start_time || ts()),
      cmt_voucher_status: 1,
    };
    this.db.vouchers.push(voucher);
    this.storage.save();
    res.json({ error: "", message: "", request_id: rid(), response: { voucher_id } });
  }

  public getVoucher(req: Request, res: Response): void {
    const id = Number(req.query.voucher_id);
    const v = this.db.vouchers.find((x) => x.voucher_id === id) || {
      voucher_id: id,
      voucher_code: "MOCK",
      voucher_name: "Mock Voucher",
      start_time: ts(),
      end_time: ts() + 86400,
    };
    res.json({ error: "", message: "", request_id: rid(), response: v });
  }

  public getVoucherList(_req: Request, res: Response): void {
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: { more: false, voucher_list: this.db.vouchers },
    });
  }

  public updateVoucher(req: Request, res: Response): void {
    const body = req.body || {};
    const v = this.db.vouchers.find((x) => x.voucher_id === Number(body.voucher_id));
    if (v) {
      Object.assign(v, body);
      this.storage.save();
    }
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: { voucher_id: Number(body.voucher_id) },
    });
  }

  public deleteVoucher(req: Request, res: Response): void {
    const id = Number(req.body?.voucher_id);
    const idx = this.db.vouchers.findIndex((x) => x.voucher_id === id);
    if (idx !== -1) {
      this.db.vouchers.splice(idx, 1);
      this.storage.save();
    }
    res.json({ error: "", message: "", request_id: rid(), response: { voucher_id: id } });
  }

  public endVoucher(req: Request, res: Response): void {
    const id = Number(req.body?.voucher_id);
    res.json({ error: "", message: "", request_id: rid(), response: { voucher_id: id } });
  }
}
