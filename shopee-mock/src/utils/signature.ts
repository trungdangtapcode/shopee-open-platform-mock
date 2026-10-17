import crypto from "crypto";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { ShopeeMockConfig } from "../schemas";
import { rid } from "./helpers";

export function computeHmacSignature(
  config: ShopeeMockConfig,
  apiPath: string,
  timestamp: string | number,
  accessToken = "",
  shopId: string | number = "",
  merchantId: string | number = ""
): { baseString: string; expected: string } {
  let baseString = `${config.partnerId}${apiPath}${timestamp}`;
  if (accessToken) {
    baseString += accessToken;
    if (shopId) baseString += shopId;
    if (merchantId) baseString += merchantId;
  }
  const expected = crypto.createHmac("sha256", config.partnerKey).update(baseString).digest("hex");
  return { baseString, expected };
}

export function verifySignature(config: ShopeeMockConfig, req: Request, res: Response): boolean {
  if (!config.strictSig) return true;
  const { partner_id, timestamp, sign, access_token = "", shop_id = "", merchant_id = "" } = req.query;
  if (!partner_id || !timestamp || !sign) {
    res.status(400).json({
      error: "error_param",
      message: "Missing partner_id, timestamp, or sign.",
      request_id: rid(),
    });
    return false;
  }
  const fullPath = req.originalUrl.split("?")[0];
  const { expected } = computeHmacSignature(
    config,
    fullPath,
    String(timestamp),
    String(access_token),
    String(shop_id),
    String(merchant_id)
  );
  if (sign !== expected) {
    res.status(401).json({
      error: "error_sign",
      message: `Invalid signature. Expected: ${expected}`,
      request_id: rid(),
    });
    return false;
  }
  return true;
}

export function createRequireAuth(config: ShopeeMockConfig): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!verifySignature(config, req, res)) return;
    next();
  };
}
