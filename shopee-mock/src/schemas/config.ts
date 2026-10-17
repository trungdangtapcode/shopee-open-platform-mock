import path from "path";

export interface ShopeeMockConfig {
  port: number;
  partnerId: number;
  partnerKey: string;
  shopId: number;
  accessToken: string;
  refreshToken: string;
  strictSig: boolean;
  odooWebhookUrl: string;
  stateFile: string;
  publicDir: string;
  schemasDir: string;
}

export const DEFAULT_CONFIG: ShopeeMockConfig = {
  port: Number(process.env.PORT || 3000),
  partnerId: Number(process.env.PARTNER_ID || 1),
  partnerKey: String(process.env.PARTNER_KEY || "1"),
  shopId: Number(process.env.SHOP_ID || 222),
  accessToken: String(process.env.ACCESS_TOKEN || "mock_access_token_shopee_2025"),
  refreshToken: String(process.env.REFRESH_TOKEN || "mock_refresh_token_shopee_2025"),
  strictSig: process.env.STRICT_SIG === "true",
  odooWebhookUrl: String(process.env.ODOO_WEBHOOK_URL || "http://localhost:8069/shopee/webhook"),
  stateFile: path.join(__dirname, "..", "..", "shopee_mock_state.json"),
  publicDir: path.join(__dirname, "..", "..", "public"),
  schemasDir: path.resolve(__dirname, "..", "..", "..", "shopee-sdk", "schemas"),
};
