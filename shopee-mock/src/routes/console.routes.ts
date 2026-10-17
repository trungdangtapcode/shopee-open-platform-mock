import { execFile } from 'child_process';
import path from 'path';
import { Request, Response, Router } from 'express';
import { CONFIG, ts } from '../config/env';
import { computeHmacSignature } from '../middleware/signature';
import { getSchemaRegistry } from '../services/schema-loader.service';
import { DB } from '../store/database';

export const consoleRouter = Router();

consoleRouter.get('/console', (_req: Request, res: Response) => {
  res.sendFile(path.join(CONFIG.publicDir, 'console.html'));
});

consoleRouter.get('/api/console/meta', (_req: Request, res: Response) => {
  const { catalog } = getSchemaRegistry();
  const activePartnerId = process.env.PARTNER_ID || CONFIG.partnerId;
  const activePartnerKey = process.env.PARTNER_KEY || CONFIG.partnerKey;

  res.json({
    partner_id: Number(activePartnerId),
    partner_key: activePartnerKey,
    shop_id: DB.shop.shop_id,
    shop_name: DB.shop.shop_name,
    region: DB.shop.region,
    strict_sig: process.env.STRICT_SIG === 'true' || CONFIG.strictSig,
    counts: {
      endpoints: catalog.length,
      products: DB.products.length,
      orders: DB.orders.length,
      vouchers: DB.vouchers.length,
      discounts: DB.discounts.length,
    },
    first_order_sn: DB.orders[0] ? DB.orders[0].order_sn : 'SPX20260521001',
    first_item_id: DB.products[0] ? DB.products[0].item_id : 10001,
    logs: DB.apiLogs.slice(0, 40),
    catalog,
  });
});

consoleRouter.post('/api/console/sign', (req: Request, res: Response) => {
  const activePartnerId = process.env.PARTNER_ID || CONFIG.partnerId;
  const activePartnerKey = process.env.PARTNER_KEY || CONFIG.partnerKey;

  const {
    partner_id = activePartnerId,
    partner_key = activePartnerKey,
    api_path = '/api/v2/shop/get_shop_info',
    access_token = '',
    shop_id = '',
    auth = true,
    timestamp: customTs,
  } = req.body || {};

  const timestamp = customTs ? Number(customTs) : ts();
  const useAuth = Boolean(auth && access_token);
  const { baseString, sign } = computeHmacSignature({
    partnerId: partner_id,
    partnerKey: String(partner_key),
    apiPath: String(api_path),
    timestamp,
    accessToken: useAuth ? String(access_token) : '',
    entityId: useAuth ? String(shop_id) : '',
  });

  res.json({
    partner_id: Number(partner_id),
    api_path,
    timestamp,
    base_string: baseString,
    sign,
    auth: useAuth,
  });
});

consoleRouter.post('/api/console/run-python-tests', (req: Request, res: Response) => {
  const host = req.get('host') || `localhost:${CONFIG.port}`;
  const baseUrl = `${req.protocol}://${host}/api/v2`;
  const authUrl = `${req.protocol}://${host}/auth`;
  const scriptPath = path.resolve(__dirname, '../../../python-shopee-sdk/test_app.py');
  const activePartnerId = process.env.PARTNER_ID || CONFIG.partnerId;
  const activePartnerKey = process.env.PARTNER_KEY || CONFIG.partnerKey;

  execFile(
    'python3',
    [scriptPath],
    {
      env: {
        ...process.env,
        SHOPEE_PARTNER_ID: String(activePartnerId),
        SHOPEE_PARTNER_KEY: String(activePartnerKey),
        SHOPEE_SHOP_ID: String(DB.shop.shop_id),
        SHOPEE_BASE_URL: baseUrl,
        SHOPEE_AUTH_URL: authUrl,
      },
      timeout: 25000,
    },
    (err, stdout, stderr) => {
      res.json({
        success: !err,
        exit_code: err ? (err as { code?: number }).code || 1 : 0,
        stdout: stdout || '',
        stderr: stderr || (err ? err.message : ''),
      });
    }
  );
});

consoleRouter.post('/api/console/clear-logs', (_req: Request, res: Response) => {
  DB.apiLogs = [];
  res.json({ ok: true });
});
