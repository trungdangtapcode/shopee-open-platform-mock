import { Request, Response } from "express";
import { ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { rid, verifySignature } from "../utils";
import { BaseManager } from "./base.manager";

export class AuthManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get("/auth", this.handleAuthorizePage.bind(this));
    this.router.get("/api/v2/auth/authorize", this.handleAuthorizePage.bind(this));
    this.router.get("/api/v2/shop/auth_partner", this.handleAuthPartner.bind(this));
    this.router.post("/api/v2/auth/token/get", this.handleTokenGet.bind(this));
    this.router.post("/api/v2/auth/access_token/get", this.handleAccessTokenGet.bind(this));
  }

  /**
   * Render OAuth 2.0 store authorization page or auto-redirect
   */
  public handleAuthorizePage(req: Request, res: Response): void {
    const redirectUri = String(req.query.redirect || req.query.redirect_uri || req.query.redirect_url || "");
    const partnerId = String(req.query.partner_id || this.config.partnerId);
    const state = String(req.query.state || "");
    const code = "MOCK_AUTH_CODE_" + Date.now();
    const callbackUrl = redirectUri
      ? `${redirectUri}${redirectUri.includes("?") ? "&" : "?"}code=${code}&shop_id=${this.config.shopId}${state ? `&state=${encodeURIComponent(state)}` : ""}`
      : "";

    if (req.query.auto_redirect === "true" && callbackUrl) {
      res.redirect(callbackUrl);
      return;
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><title>Shopee Open Platform – Authorize Store</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    body { background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,.10); width: 420px; overflow: hidden; }
    .header { background: #EE4D2D; padding: 24px 28px; color: #fff; }
    .body { padding: 28px; }
    .shop-box { background: #fff8f6; border: 1px solid #ffd5cc; border-radius: 6px; padding: 14px 16px; margin-bottom: 20px; }
    .btn { display: block; width: 100%; padding: 13px; border: none; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; text-align: center; text-decoration: none; }
    .btn-primary { background: #EE4D2D; color: #fff; margin-bottom: 10px; }
    .meta { margin-top: 18px; padding-top: 14px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; }
  </style>
</head>
<body>
<div class="card">
  <div class="header"><h1>Shopee Open Platform</h1><p>Store Authorization Request (MOCK)</p></div>
  <div class="body">
    <div class="shop-box">
      <div style="font-weight:600;font-size:15px">${this.db.shop.shop_name}</div>
      <div style="font-size:12px;color:#888;margin-top:4px">Shop ID: <strong>${this.config.shopId}</strong> &bull; Partner ID: <strong>${partnerId}</strong></div>
    </div>
    ${
      callbackUrl
        ? `<a class="btn btn-primary" href="${callbackUrl}">Authorize &amp; Grant Access</a>`
        : `<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px;font-size:12px;color:#856404">No <code>redirect</code> URL provided.<br><br>Auth code: <strong>${code}</strong><br>Shop ID: <strong>${this.config.shopId}</strong></div>`
    }
    <div class="meta">Auth Code: <code>${code}</code></div>
  </div>
</div>
</body>
</html>`);
  }

  /**
   * Redirect to /auth for partner authorization
   */
  public handleAuthPartner(req: Request, res: Response): void {
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    res.redirect(`/auth?${qs}`);
  }

  /**
   * Exchange authorization code for access_token & refresh_token
   */
  public handleTokenGet(req: Request, res: Response): void {
    if (!verifySignature(this.config, req, res)) return;
    const payload = {
      access_token: this.config.accessToken,
      refresh_token: this.config.refreshToken,
      expire_in: 14400,
      shop_id: Number(req.body?.shop_id || this.config.shopId),
      merchant_id_list: [],
      shop_id_list: [Number(req.body?.shop_id || this.config.shopId)],
    };
    res.json({ error: "", message: "", request_id: rid(), ...payload, response: payload });
  }

  /**
   * Refresh access_token using refresh_token
   */
  public handleAccessTokenGet(req: Request, res: Response): void {
    if (!verifySignature(this.config, req, res)) return;
    const payload = {
      access_token: this.config.accessToken,
      refresh_token: this.config.refreshToken,
      expire_in: 14400,
      partner_id: Number(req.body?.partner_id || this.config.partnerId),
      shop_id: Number(req.body?.shop_id || this.config.shopId),
    };
    res.json({ error: "", message: "", request_id: rid(), ...payload, response: payload });
  }
}
