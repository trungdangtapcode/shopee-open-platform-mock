import { Request, Response, Router } from 'express';
import { rid, ts } from '../config/env';
import { requireAuth } from '../middleware/signature';
import { DB } from '../store/database';

export const publicRouter = Router();

publicRouter.get('/get_shopee_ip_ranges', requireAuth, (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    ip_list: ['103.48.80.0/22', '143.92.64.0/20', '203.116.172.0/23'],
    response: {
      ip_list: ['103.48.80.0/22', '143.92.64.0/20', '203.116.172.0/23'],
    },
  });
});

publicRouter.get('/get_shops_by_partner', requireAuth, (_req: Request, res: Response) => {
  const authed_shop_list = [
    {
      shop_id: DB.shop.shop_id,
      region: DB.shop.region,
      sip_affi_shops: [],
      auth_time: DB.shop.auth_time || ts() - 86400,
      expire_time: DB.shop.expire_time || ts() + 86400 * 30,
    },
  ];
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    authed_shop_list,
    more: false,
    response: { authed_shop_list, more: false },
  });
});

publicRouter.get('/get_merchants_by_partner', requireAuth, (_req: Request, res: Response) => {
  const authed_merchant_list = [
    {
      merchant_id: 900001,
      region: DB.shop.region,
      auth_time: ts() - 86400,
      expire_time: ts() + 86400 * 30,
    },
  ];
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    authed_merchant_list,
    more: false,
    response: { authed_merchant_list, more: false },
  });
});

publicRouter.post('/get_token_by_resend_code', requireAuth, (req: Request, res: Response) => {
  const { resend_code } = req.body || {};
  if (
    resend_code &&
    (String(resend_code).includes('INVALID') || String(resend_code).includes('DUMMY'))
  ) {
    res.status(400).json({
      error: 'error_auth',
      message: 'Invalid resend_code.',
      request_id: rid(),
    });
    return;
  }
  const tokenData = {
    access_token: 'MOCK_RESEND_ACCESS_TOKEN_' + Date.now(),
    refresh_token: 'MOCK_RESEND_REFRESH_TOKEN_' + Date.now(),
    expire_in: 14400,
    shop_id_list: [DB.shop.shop_id],
    merchant_id_list: [],
  };
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    ...tokenData,
    response: tokenData,
  });
});
