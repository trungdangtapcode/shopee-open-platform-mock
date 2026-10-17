import { Request, Response } from "express";
import { ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { rid, verifySignature } from "../utils";
import { BaseManager } from "./base.manager";

export class PublicManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get("/get_shopee_ip_ranges", this.getShopeeIpRanges.bind(this));
    this.router.get("/get_shops_by_partner", this.getShopsByPartner.bind(this));
    this.router.get("/get_merchants_by_partner", this.getMerchantsByPartner.bind(this));
    this.router.post("/get_token_by_resend_code", this.getTokenByResendCode.bind(this));
  }

  /**
   * Get Shopee official webhook IP address ranges
   */
  public getShopeeIpRanges(req: Request, res: Response): void {
    if (!verifySignature(this.config, req, res)) return;
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      ip_list: ["103.116.192.0/24", "147.160.176.0/24", "127.0.0.1/32"],
      response: {
        ip_list: ["103.116.192.0/24", "147.160.176.0/24", "127.0.0.1/32"],
      },
    });
  }

  /**
   * Get authorized shops bound to partner app
   */
  public getShopsByPartner(req: Request, res: Response): void {
    if (!verifySignature(this.config, req, res)) return;
    const authedShopList = [
      {
        shop_id: this.db.shop.shop_id,
        region: this.db.shop.region,
        sip_affi_shops: [],
        auth_time: this.db.shop.auth_time,
        expire_time: this.db.shop.expire_time,
      },
    ];
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      authed_shop_list: authedShopList,
      more: false,
      response: { authed_shop_list: authedShopList, more: false },
    });
  }

  /**
   * Get authorized merchants bound to partner app
   */
  public getMerchantsByPartner(req: Request, res: Response): void {
    if (!verifySignature(this.config, req, res)) return;
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      authed_merchant_list: [],
      more: false,
      response: { authed_merchant_list: [], more: false },
    });
  }

  /**
   * Exchange resend code for access_token
   */
  public getTokenByResendCode(req: Request, res: Response): void {
    if (!verifySignature(this.config, req, res)) return;
    const payload = {
      access_token: this.config.accessToken,
      refresh_token: this.config.refreshToken,
      expire_in: 14400,
      shop_id_list: [this.db.shop.shop_id],
      merchant_id_list: [],
    };
    res.json({ error: "", message: "", request_id: rid(), ...payload, response: payload });
  }
}
