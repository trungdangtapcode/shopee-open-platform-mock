import { Request, Response } from "express";
import { ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { rid } from "../utils";
import { BaseManager } from "./base.manager";

export class ShopManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get("/get_shop_info", this.requireAuth, this.getShopInfo.bind(this));
    this.router.get("/get_profile", this.requireAuth, this.getProfile.bind(this));
    this.router.post("/update_profile", this.requireAuth, this.updateProfile.bind(this));
  }

  /**
   * Get basic shop information
   */
  public getShopInfo(_req: Request, res: Response): void {
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      ...this.db.shop,
      response: this.db.shop,
    });
  }

  /**
   * Get shop profile (logo, name, description)
   */
  public getProfile(_req: Request, res: Response): void {
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        shop_logo: this.db.shop.shop_logo,
        description: this.db.shop.description,
        shop_name: this.db.shop.shop_name,
      },
    });
  }

  /**
   * Update shop profile
   */
  public updateProfile(req: Request, res: Response): void {
    const { shop_name, description, shop_logo } = req.body || {};
    if (shop_name) this.db.shop.shop_name = shop_name;
    if (description !== undefined) this.db.shop.description = description;
    if (shop_logo) this.db.shop.shop_logo = shop_logo;
    this.storage.save();
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        shop_logo: this.db.shop.shop_logo,
        description: this.db.shop.description,
        shop_name: this.db.shop.shop_name,
      },
    });
  }
}
