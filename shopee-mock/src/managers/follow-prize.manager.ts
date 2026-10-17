import { Request, Response } from "express";
import { FollowPrizeRecord, ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { rid, ts } from "../utils";
import { BaseManager } from "./base.manager";

export class FollowPrizeManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post("/add_follow_prize", this.requireAuth, this.addFollowPrize.bind(this));
    this.router.get("/get_follow_prize_detail", this.requireAuth, this.getFollowPrizeDetail.bind(this));
    this.router.get("/get_follow_prize_list", this.requireAuth, this.getFollowPrizeList.bind(this));
    this.router.post("/update_follow_prize", this.requireAuth, this.updateFollowPrize.bind(this));
    this.router.post("/delete_follow_prize", this.requireAuth, this.deleteFollowPrize.bind(this));
    this.router.post("/end_follow_prize", this.requireAuth, this.endFollowPrize.bind(this));
  }

  public addFollowPrize(req: Request, res: Response): void {
    const body = req.body || {};
    const campaign_id = this.db.nextIds.followPrize++;
    const fp: FollowPrizeRecord = {
      campaign_id,
      campaign_status: "upcoming",
      follow_prize_name: String(body.follow_prize_name || "Mock Follow Prize"),
      start_time: Number(body.start_time || ts() + 60),
      end_time: Number(body.end_time || ts() + 86400),
      usage_quantity: Number(body.usage_quantity ?? 50),
      min_spend: Number(body.min_spend ?? 100),
      reward_type: Number(body.reward_type ?? 1),
      discount_amount: Number(body.discount_amount ?? 10),
      percentage: Number(body.percentage ?? 0),
      max_price: Number(body.max_price ?? 0),
    };
    this.db.followPrizes.push(fp);
    this.storage.save();
    res.json({ error: "", message: "", request_id: rid(), response: { campaign_id } });
  }

  public getFollowPrizeDetail(req: Request, res: Response): void {
    const id = Number(req.query.campaign_id);
    const fp = this.db.followPrizes.find((x) => x.campaign_id === id) || {
      campaign_id: id,
      campaign_status: "upcoming",
      follow_prize_name: "Mock Follow Prize",
      start_time: ts(),
      end_time: ts() + 86400,
      usage_quantity: 50,
      min_spend: 100,
      reward_type: 1,
    };
    res.json({ error: "", message: "", request_id: rid(), response: fp });
  }

  public getFollowPrizeList(_req: Request, res: Response): void {
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: { follow_prize_list: this.db.followPrizes, more: false },
    });
  }

  public updateFollowPrize(req: Request, res: Response): void {
    const body = req.body || {};
    const fp = this.db.followPrizes.find((x) => x.campaign_id === Number(body.campaign_id));
    if (fp) {
      Object.assign(fp, body);
      this.storage.save();
    }
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: { campaign_id: Number(body.campaign_id) },
    });
  }

  public deleteFollowPrize(req: Request, res: Response): void {
    const id = Number(req.body?.campaign_id);
    const idx = this.db.followPrizes.findIndex((x) => x.campaign_id === id);
    if (idx !== -1) {
      this.db.followPrizes.splice(idx, 1);
      this.storage.save();
    }
    res.json({ error: "", message: "", request_id: rid(), response: { campaign_id: id } });
  }

  public endFollowPrize(req: Request, res: Response): void {
    const id = Number(req.body?.campaign_id);
    res.json({ error: "", message: "", request_id: rid(), response: { campaign_id: id } });
  }
}
