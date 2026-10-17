import { Request, Response, Router } from 'express';
import { CONFIG, rid } from '../config/env';
import { requireAuth } from '../middleware/signature';
import { DB } from '../store/database';

export const authRouter = Router();

function resolveOdooCallback(req: Request, extraParams: Record<string, string>): string {
  const ODOO_CALLBACK_PATH = '/web/action/shopee_connector.action_shopee_auth_callback';
  let odooBase = CONFIG.odooBaseUrl;
  if (!odooBase) {
    const referer = req.get('Referer') || req.get('Origin') || '';
    if (referer) {
      try {
        const u = new URL(referer);
        odooBase = `${u.protocol}//${u.host}`;
      } catch (_) {}
    }
  }
  if (!odooBase) {
    const self = `${req.protocol}://${req.get('host')}`;
    return `${self}/api/v2/auth/callback?${new URLSearchParams(extraParams).toString()}`;
  }
  return `${odooBase}${ODOO_CALLBACK_PATH}?${new URLSearchParams(extraParams).toString()}`;
}

function buildAuthUrl(req: Request): string {
  const redirect = String(req.query.redirect || req.query.redirect_url || '');
  const self = `${req.protocol}://${req.get('host')}`;
  const odooCallback =
    redirect ||
    (CONFIG.odooBaseUrl
      ? `${CONFIG.odooBaseUrl}/web/action/shopee_connector.action_shopee_auth_callback`
      : '');
  const params = new URLSearchParams({
    shop_id: String(DB.shop.shop_id),
    code: 'MOCK_AUTH_CODE_2026',
    ...(odooCallback ? { redirect_url: odooCallback } : {}),
  });
  return `${self}/api/v2/auth/authorize?${params.toString()}`;
}

function handleAuthorizePage(req: Request, res: Response): void {
  const redirectTarget = String(
    req.query.redirect_url || req.query.redirect_uri || req.query.redirect || ''
  );
  const shop_id = String(req.query.shop_id || DB.shop.shop_id);
  const code = String(req.query.code || 'MOCK_AUTH_CODE_2026');
  const state = req.query.state ? String(req.query.state) : undefined;
  const extraParams: Record<string, string> = { code, shop_id, ...(state ? { state } : {}) };

  const callbackUrl = redirectTarget
    ? `${redirectTarget}${redirectTarget.includes('?') ? '&' : '?'}${new URLSearchParams(extraParams).toString()}`
    : resolveOdooCallback(req, extraParams);

  if (req.query.auto_redirect === 'true') {
    res.redirect(callbackUrl);
    return;
  }

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Shopee — Authorize</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:white;border-radius:16px;padding:32px;max-width:400px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,0.08);text-align:center}
.logo{width:56px;height:56px;background:#EE4D2D;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:26px;font-weight:700;margin:0 auto 16px}
h2{font-size:18px;margin-bottom:6px}.sub{font-size:13px;color:#888;margin-bottom:24px}
.shop-box{background:#fff8f6;border:1px solid #fde0d8;border-radius:10px;padding:14px;margin-bottom:24px;text-align:left}
.label{font-size:11px;color:#aaa;margin-bottom:2px}.value{font-size:13px;font-weight:600}
.perms{text-align:left;margin-bottom:24px}.perm{display:flex;align-items:center;gap:8px;font-size:12px;color:#555;padding:5px 0;border-bottom:1px solid #f5f5f5}
.perm:last-child{border-bottom:none}.pi{color:#16a34a}
.btn{display:block;width:100%;padding:13px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:all .15s;margin-bottom:10px}
.bp{background:#EE4D2D;color:white}.bp:hover{background:#d94426}
.bs{background:#f5f5f5;color:#555}.bs:hover{background:#eee}
.mb{font-size:10px;color:#bbb;margin-top:16px}</style></head><body>
<div class="card">
  <div class="logo">S</div>
  <h2>Authorize App Access</h2>
  <p class="sub">An app is requesting access to your Shopee store</p>
  <div class="shop-box">
    <div class="label">Store</div><div class="value">${DB.shop.shop_name}</div>
    <div class="label" style="margin-top:8px">Shop ID</div><div class="value">${DB.shop.shop_id} · ${DB.shop.region}</div>
  </div>
  <div class="perms">
    <div class="perm"><span class="pi">✓</span> Read and manage products &amp; inventory</div>
    <div class="perm"><span class="pi">✓</span> Read and manage orders</div>
    <div class="perm"><span class="pi">✓</span> Initiate shipments &amp; print labels</div>
    <div class="perm"><span class="pi">✓</span> Access shop info &amp; settings</div>
  </div>
  <button class="btn bp" id="ab" onclick="authorize()">Authorize</button>
  <button class="btn bs" onclick="window.close()">Cancel</button>
  <div class="mb">🟠 Shopee Mock API — Demo environment</div>
</div>
<script>function authorize(){const b=document.getElementById('ab');b.textContent='Authorizing...';b.disabled=true;setTimeout(()=>{window.location.href=${JSON.stringify(callbackUrl)};},500)}</script>
</body></html>`);
}

authRouter.get('/auth', handleAuthorizePage);
authRouter.get('/api/v2/auth/authorize', handleAuthorizePage);

authRouter.get('/api/v2/shop/auth_partner', (req: Request, res: Response) => {
  res.json({ error: '', message: '', request_id: rid(), response: { auth_url: buildAuthUrl(req) } });
});

authRouter.get('/api/v2/auth/shop/get_auth_link', (req: Request, res: Response) => {
  res.json({ error: '', message: '', request_id: rid(), response: { auth_url: buildAuthUrl(req) } });
});

authRouter.get('/api/v2/auth/callback', (req: Request, res: Response) => {
  const code = String(req.query.code || 'MOCK_AUTH_CODE_2026');
  const shop_id = String(req.query.shop_id || DB.shop.shop_id);
  const state = req.query.state ? String(req.query.state) : undefined;
  const redirectTarget = String(
    req.query.redirect || req.query.redirect_uri || req.query.redirect_url || ''
  );
  const extraParams: Record<string, string> = { code, shop_id, ...(state ? { state } : {}) };
  if (redirectTarget) {
    const sep = redirectTarget.includes('?') ? '&' : '?';
    res.redirect(`${redirectTarget}${sep}${new URLSearchParams(extraParams).toString()}`);
    return;
  }
  res.redirect(resolveOdooCallback(req, extraParams));
});

authRouter.post('/api/v2/auth/token/get', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  if (body.code === 'INVALID_CODE') {
    res.status(400).json({ error: 'error_auth', message: 'Invalid code', request_id: rid() });
    return;
  }
  const shop_id = body.shop_id ? Number(body.shop_id) : DB.shop.shop_id;
  const tokenPayload = {
    access_token: 'MOCK_ACCESS_TOKEN_' + Date.now(),
    refresh_token: 'MOCK_REFRESH_TOKEN_' + Date.now(),
    expire_in: 14400,
    refresh_expire_in: 2592000,
    shop_id,
    shop_id_list: [shop_id],
    merchant_id_list: [],
  };
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    ...tokenPayload,
    response: { ...tokenPayload },
  });
});

authRouter.post('/api/v2/auth/access_token/get', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  if (body.refresh_token === 'INVALID_REFRESH_TOKEN') {
    res.status(400).json({ error: 'error_auth', message: 'Invalid refresh_token.', request_id: rid() });
    return;
  }
  const shop_id = body.shop_id ? Number(body.shop_id) : DB.shop.shop_id;
  const activePartnerId = process.env.PARTNER_ID || CONFIG.partnerId;
  const partner_id = body.partner_id ? Number(body.partner_id) : Number(activePartnerId);
  const refreshPayload = {
    partner_id,
    shop_id,
    access_token: 'MOCK_ACCESS_TOKEN_REFRESHED_' + Date.now(),
    refresh_token: 'MOCK_REFRESH_TOKEN_REFRESHED_' + Date.now(),
    expire_in: 14400,
  };
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    ...refreshPayload,
    response: { ...refreshPayload },
  });
});
