import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { CONFIG, rid } from '../config/env';

export function computeHmacSignature(params: {
  partnerId: string | number;
  partnerKey: string;
  apiPath: string;
  timestamp: string | number;
  accessToken?: string;
  entityId?: string | number;
}): { baseString: string; sign: string } {
  const { partnerId, partnerKey, apiPath, timestamp, accessToken = '', entityId = '' } = params;
  const baseString = accessToken
    ? `${partnerId}${apiPath}${timestamp}${accessToken}${entityId}`
    : `${partnerId}${apiPath}${timestamp}`;
  const sign = crypto.createHmac('sha256', String(partnerKey)).update(baseString).digest('hex');
  return { baseString, sign };
}

export function verifySignature(req: Request): boolean {
  if (process.env.STRICT_SIG !== 'true' && !CONFIG.strictSig) return true;
  const { partner_id, timestamp, sign } = req.query;
  if (!partner_id || !timestamp || !sign) return false;
  const activePartnerId = process.env.PARTNER_ID || CONFIG.partnerId;
  const activePartnerKey = process.env.PARTNER_KEY || CONFIG.partnerKey;
  if (String(partner_id) !== String(activePartnerId)) return false;

  const accessToken = String(req.query.access_token || '');
  const entityId = accessToken
    ? String(req.query.shop_id || req.query.merchant_id || '')
    : '';

  const apiPath = req.originalUrl.split('?')[0];
  const { sign: expected } = computeHmacSignature({
    partnerId: activePartnerId,
    partnerKey: activePartnerKey,
    apiPath,
    timestamp: String(timestamp),
    accessToken,
    entityId,
  });
  return String(sign) === expected;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!verifySignature(req)) {
    res.status(401).json({
      error: 'error_sign',
      message: 'Wrong sign.',
      request_id: rid(),
    });
    return;
  }
  next();
}
