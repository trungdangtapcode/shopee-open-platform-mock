/**
 * Shopee Open Platform Developer Console UI (/console)
 *
 * Provides a full browser-based Developer Console modeled after open.shopee.com:
 * 1. App Credentials & OAuth 2.0 Token Generator (authorize, exchange code, refresh token)
 * 2. API Test Tool & Schema Explorer for all 455 Shopee v2 endpoints (with live HMAC-SHA256 signing,
 *    auto-populated sample payloads, inline PDF airway bill viewer, Python SDK & cURL code generator)
 * 3. Built-in Python SDK Test Suite Runner (executes python-shopee-sdk/test_app.py from the browser)
 * 4. Live API Request Log Inspector
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildSampleRequestFromParams(params) {
  const obj = {};
  for (const p of (params || [])) {
    if (['partner_id', 'timestamp', 'access_token', 'shop_id', 'sign', 'merchant_id'].includes(p.name)) {
      continue;
    }
    const t = (p.type || '').toLowerCase();
    if (t.includes('[]')) {
      if (p.children && p.children.length) {
        obj[p.name] = [buildSampleRequestFromParams(p.children)];
      } else if (t.includes('int') || t.includes('number')) {
        obj[p.name] = [Number(p.sample) || 10001];
      } else {
        obj[p.name] = [p.sample || 'SPX20260521001'];
      }
    } else if (t === 'object' || (p.children && p.children.length)) {
      obj[p.name] = buildSampleRequestFromParams(p.children);
    } else if (t.includes('int') || t.includes('float') || t.includes('number') || t === 'timestamp') {
      obj[p.name] = p.sample !== undefined && p.sample !== '' ? Number(p.sample) : 1;
    } else if (t === 'boolean') {
      obj[p.name] = p.sample === 'true' || p.sample === true;
    } else {
      obj[p.name] = p.sample !== undefined ? String(p.sample) : '';
    }
  }
  return obj;
}

function loadFullEndpointCatalog(schemasDir) {
  const catalog = [];
  if (!schemasDir || !fs.existsSync(schemasDir)) return catalog;

  const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.json')).sort();
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(schemasDir, file), 'utf8'));
      if (!raw.path || !raw.api_name) continue;
      const parts = raw.api_name.split('.');
      const moduleName = parts[1] || 'other';
      const method = raw.method === 1 ? 'POST' : 'GET';
      const reqParams = (raw.params && raw.params.request_params) || [];
      const sampleReq = buildSampleRequestFromParams(reqParams);
      const desc = stripHtml(raw.define && raw.define.content);

      catalog.push({
        api_name: raw.api_name,
        module: moduleName,
        method,
        path: raw.path,
        api_type: raw.api_type || 'Shop',
        description: desc || `${method} ${raw.path}`,
        sample_request: sampleReq,
        param_docs: reqParams.slice(0, 25).map(p => ({
          name: p.name,
          type: p.type || 'string',
          required: p.required === 'True' || p.required === true,
          description: stripHtml(p.description).slice(0, 140),
        })),
      });
    } catch (_) {}
  }
  return catalog;
}

function registerConsoleRoutes(app, { DB, PARTNER_ID, PARTNER_KEY, schemasDir }) {
  DB.apiLogs = DB.apiLogs || [];

  const resolvedSchemasDir = schemasDir || path.resolve(__dirname, '../shopee-sdk/schemas');
  const catalog = loadFullEndpointCatalog(resolvedSchemasDir);

  // Middleware to record /api/v2/* traffic for the Live Request Inspector
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/v2/')) {
      const start = Date.now();
      const origEnd = res.end;
      res.end = function (...args) {
        DB.apiLogs.unshift({
          id: 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          time: new Date().toISOString().replace('T', ' ').substring(0, 19),
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration_ms: Date.now() - start,
          query: req.query,
          body: req.body && Object.keys(req.body).length ? req.body : undefined,
        });
        if (DB.apiLogs.length > 60) DB.apiLogs.length = 60;
        return origEnd.apply(this, args);
      };
    }
    next();
  });

  // Return console metadata & endpoint catalog
  app.get('/api/console/meta', (req, res) => {
    res.json({
      partner_id: Number(PARTNER_ID),
      partner_key: PARTNER_KEY,
      shop_id: DB.shop.shop_id,
      shop_name: DB.shop.shop_name,
      region: DB.shop.region,
      strict_sig: process.env.STRICT_SIG === 'true',
      counts: {
        endpoints: catalog.length,
        products: DB.products.length,
        orders: DB.orders.length,
        vouchers: (DB.vouchers || []).length,
        discounts: (DB.discounts || []).length,
      },
      first_order_sn: DB.orders[0] ? DB.orders[0].order_sn : 'SPX20260521001',
      first_item_id: DB.products[0] ? DB.products[0].item_id : 10001,
      logs: DB.apiLogs.slice(0, 40),
      catalog,
    });
  });

  // Compute HMAC-SHA256 signature for any API request
  app.post('/api/console/sign', (req, res) => {
    const {
      partner_id = PARTNER_ID,
      partner_key = PARTNER_KEY,
      api_path = '/api/v2/shop/get_shop_info',
      access_token = '',
      shop_id = '',
      auth = true,
      timestamp: customTs,
    } = req.body || {};

    const timestamp = customTs ? Number(customTs) : Math.floor(Date.now() / 1000);
    const useAuth = Boolean(auth && access_token);
    const base_string = useAuth
      ? `${partner_id}${api_path}${timestamp}${access_token}${shop_id}`
      : `${partner_id}${api_path}${timestamp}`;
    const sign = crypto.createHmac('sha256', String(partner_key)).update(base_string).digest('hex');

    res.json({
      partner_id: Number(partner_id),
      api_path,
      timestamp,
      base_string,
      sign,
      auth: useAuth,
    });
  });

  // Execute the Python SDK End-to-End Test Suite against this running server
  app.post('/api/console/run-python-tests', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${req.protocol}://${host}/api/v2`;
    const authUrl = `${req.protocol}://${host}/auth`;
    const scriptPath = path.resolve(__dirname, '../python-shopee-sdk/test_app.py');

    execFile(
      'python3',
      [scriptPath],
      {
        env: {
          ...process.env,
          SHOPEE_PARTNER_ID: String(PARTNER_ID),
          SHOPEE_PARTNER_KEY: String(PARTNER_KEY),
          SHOPEE_SHOP_ID: String(DB.shop.shop_id),
          SHOPEE_BASE_URL: baseUrl,
          SHOPEE_AUTH_URL: authUrl,
        },
        timeout: 20000,
      },
      (err, stdout, stderr) => {
        res.json({
          success: !err,
          exit_code: err ? err.code || 1 : 0,
          stdout: stdout || '',
          stderr: stderr || (err ? err.message : ''),
        });
      }
    );
  });

  // Clear request logs
  app.post('/api/console/clear-logs', (req, res) => {
    DB.apiLogs = [];
    res.json({ ok: true });
  });

  // Serve Shopee Open Platform Developer Console HTML UI
  app.get('/console', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shopee Open Platform Console — Developer & API Test Tool</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f6f9;color:#1e293b;font-size:13px;min-height:100vh;display:flex;flex-direction:column}
.op-topbar{background:#0f172a;color:white;height:54px;display:flex;align-items:center;padding:0 20px;gap:16px;position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,0.15)}
.op-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:white;font-weight:700;font-size:16px}
.op-logo{width:32px;height:32px;background:#EE4D2D;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:white}
.op-badge{background:rgba(238,77,45,0.2);color:#ff785a;border:1px solid rgba(238,77,45,0.4);padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}
.op-nav{display:flex;gap:4px;margin-left:20px}
.op-nav-btn{background:transparent;color:#94a3b8;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;transition:all .15s}
.op-nav-btn:hover{color:white;background:rgba(255,255,255,0.07)}
.op-nav-btn.active{color:white;background:#EE4D2D;font-weight:600}
.op-right{margin-left:auto;display:flex;align-items:center;gap:12px}
.op-link-btn{background:#1e293b;color:#e2e8f0;border:1px solid #334155;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:500;transition:all .15s}
.op-link-btn:hover{border-color:#EE4D2D;color:white}
.op-token-pill{display:flex;align-items:center;gap:6px;background:#1e293b;padding:5px 10px;border-radius:6px;border:1px solid #334155;font-size:11px;color:#cbd5e1}
.op-dot{width:8px;height:8px;border-radius:50%;background:#22c55e}

.op-container{flex:1;display:flex;flex-direction:column;max-width:1600px;width:100%;margin:0 auto;padding:18px}
.op-grid-4{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px}
.op-stat{background:white;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;box-shadow:0 1px 2px rgba(0,0,0,0.03)}
.op-stat-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.op-stat-val{font-size:22px;font-weight:700;color:#0f172a}
.op-stat-val.orange{color:#EE4D2D}
.op-stat-val.green{color:#16a34a}

.op-card{background:white;border:1px solid #e2e8f0;border-radius:8px;padding:18px;margin-bottom:16px;box-shadow:0 1px 2px rgba(0,0,0,0.03)}
.op-card-title{font-size:15px;font-weight:700;color:#0f172a;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between}
.op-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:14px}
.op-field{display:flex;flex-direction:column;gap:4px}
.op-field label{font-size:11px;font-weight:600;color:#475569}
.op-field input,.op-field select,.op-field textarea{padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:inherit;background:white;color:#0f172a}
.op-field input:focus,.op-field select:focus,.op-field textarea:focus{outline:none;border-color:#EE4D2D}
.op-mono{font-family:'SFMono-Regular',Consolas,monospace !important}

.op-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:none;transition:all .15s}
.op-btn-primary{background:#EE4D2D;color:white}.op-btn-primary:hover{background:#d94426}
.op-btn-dark{background:#0f172a;color:white}.op-btn-dark:hover{background:#1e293b}
.op-btn-outline{background:white;color:#334155;border:1px solid #cbd5e1}.op-btn-outline:hover{border-color:#EE4D2D;color:#EE4D2D}
.op-btn-green{background:#16a34a;color:white}.op-btn-green:hover{background:#15803d}

/* API Explorer Layout */
.op-explorer{display:grid;grid-template-columns:330px 1fr;gap:16px;min-height:660px}
.op-ep-sidebar{background:white;border:1px solid #e2e8f0;border-radius:8px;display:flex;flex-direction:column;overflow:hidden;max-height:760px}
.op-ep-filter{padding:12px;border-bottom:1px solid #e2e8f0;display:flex;flex-direction:column;gap:8px;background:#f8fafc}
.op-ep-list{flex:1;overflow-y:auto;divide-y:1px solid #f1f5f9}
.op-ep-item{padding:9px 12px;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background .1s;display:flex;flex-direction:column;gap:3px}
.op-ep-item:hover{background:#fff5f3}
.op-ep-item.active{background:#fff0ed;border-left:3px solid #EE4D2D}
.op-ep-top{display:flex;align-items:center;gap:6px}
.op-method{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;font-family:monospace}
.op-method.GET{background:#dbeafe;color:#1d4ed8}
.op-method.POST{background:#dcfce7;color:#15803d}
.op-ep-name{font-size:12px;font-weight:600;color:#0f172a;word-break:break-all}
.op-ep-path{font-size:11px;color:#64748b;font-family:monospace}

.op-ep-main{display:flex;flex-direction:column;gap:14px}
.op-code-box{background:#0f172a;color:#e2e8f0;border-radius:8px;padding:14px;font-family:'SFMono-Regular',Consolas,monospace;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;max-height:420px;overflow-y:auto}
.op-sign-banner{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;font-size:11px;color:#475569;margin-bottom:12px}
.op-sign-banner code{color:#EE4D2D;font-weight:600;word-break:break-all}

.op-presets{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.op-preset-chip{background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;padding:4px 10px;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s}
.op-preset-chip:hover{background:#fff0ed;border-color:#EE4D2D;color:#EE4D2D}

table.op-table{width:100%;border-collapse:collapse;font-size:12px}
table.op-table th{text-align:left;padding:8px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:11px}
table.op-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
</style>
</head>
<body>

<div class="op-topbar">
  <a class="op-brand" href="/console">
    <div class="op-logo">S</div>
    <span>Shopee Open Platform Console</span>
  </a>
  <span class="op-badge">v2.0 Sandbox &amp; 455-Schema Engine</span>

  <div class="op-nav">
    <button class="op-nav-btn active" onclick="showSection('explorer', this)">API Test Tool (455 APIs)</button>
    <button class="op-nav-btn" onclick="showSection('oauth', this)">App &amp; OAuth Credentials</button>
    <button class="op-nav-btn" onclick="showSection('python', this)">Python SDK Runner</button>
    <button class="op-nav-btn" onclick="showSection('logs', this)">Live Request Logs</button>
  </div>

  <div class="op-right">
    <div class="op-token-pill">
      <span class="op-dot"></span>
      <span id="top-token-status">Token Ready</span>
    </div>
    <a class="op-link-btn" href="/">🏪 Open Seller Centre UI →</a>
  </div>
</div>

<div class="op-container">
  <!-- Top Summary Metrics -->
  <div class="op-grid-4">
    <div class="op-stat">
      <div class="op-stat-label">Loaded v2 Schemas</div>
      <div class="op-stat-val orange" id="st-endpoints">455</div>
    </div>
    <div class="op-stat">
      <div class="op-stat-label">Active Partner ID</div>
      <div class="op-stat-val" id="st-partner">1</div>
    </div>
    <div class="op-stat">
      <div class="op-stat-label">Authorized Shop ID</div>
      <div class="op-stat-val green" id="st-shop">222</div>
    </div>
    <div class="op-stat">
      <div class="op-stat-label">Products / Orders</div>
      <div class="op-stat-val" id="st-data">8 / 3</div>
    </div>
    <div class="op-stat">
      <div class="op-stat-label">HMAC Signature Mode</div>
      <div class="op-stat-val green" id="st-sig">STRICT</div>
    </div>
  </div>

  <!-- SECTION 1: API TEST TOOL & 455-ENDPOINT EXPLORER -->
  <div id="sec-explorer">
    <div class="op-card" style="padding:12px 16px;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:6px;text-transform:uppercase">Quick-Select Popular Endpoints:</div>
      <div class="op-presets">
        <button class="op-preset-chip" onclick="selectByPath('/api/v2/auth/token/get')">POST /auth/token/get</button>
        <button class="op-preset-chip" onclick="selectByPath('/api/v2/shop/get_shop_info')">GET /shop/get_shop_info</button>
        <button class="op-preset-chip" onclick="selectByPath('/api/v2/product/get_item_list')">GET /product/get_item_list</button>
        <button class="op-preset-chip" onclick="selectByPath('/api/v2/product/add_item')">POST /product/add_item</button>
        <button class="op-preset-chip" onclick="selectByPath('/api/v2/product/update_stock')">POST /product/update_stock</button>
        <button class="op-preset-chip" onclick="selectByPath('/api/v2/order/get_order_list')">GET /order/get_order_list</button>
        <button class="op-preset-chip" onclick="selectByPath('/api/v2/order/get_order_detail')">GET /order/get_order_detail</button>
        <button class="op-preset-chip" onclick="selectByPath('/api/v2/logistics/ship_order')">POST /logistics/ship_order</button>
        <button class="op-preset-chip" onclick="selectByPath('/api/v2/logistics/download_shipping_document')">POST /logistics/download_shipping_document (PDF)</button>
        <button class="op-preset-chip" onclick="selectByPath('/api/v2/payment/get_escrow_detail')">GET /payment/get_escrow_detail</button>
        <button class="op-preset-chip" onclick="selectByPath('/api/v2/voucher/get_voucher_list')">GET /voucher/get_voucher_list</button>
      </div>
    </div>

    <div class="op-explorer">
      <!-- Left Sidebar: Module & Search -->
      <div class="op-ep-sidebar">
        <div class="op-ep-filter">
          <input type="text" id="ep-search" placeholder="Search 455 APIs (e.g. add_item, order, flash_sale)..." oninput="renderEndpointList()" style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px">
          <select id="ep-module" onchange="renderEndpointList()" style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;background:white">
            <option value="all">All Modules (455)</option>
          </select>
        </div>
        <div class="op-ep-list" id="ep-list"></div>
      </div>

      <!-- Right Main Panel: Request Builder & Response Viewer -->
      <div class="op-ep-main">
        <div class="op-card" style="margin-bottom:0">
          <div class="op-card-title">
            <div>
              <span class="op-method GET" id="cur-method">GET</span>
              <span class="op-mono" style="font-size:15px;margin-left:6px" id="cur-path">/api/v2/shop/get_shop_info</span>
              <span style="font-size:12px;color:#64748b;font-weight:400;margin-left:8px" id="cur-name">(v2.shop.get_shop_info)</span>
            </div>
            <div style="display:flex;gap:8px">
              <button class="op-btn op-btn-outline" onclick="refreshSignaturePreview()">↻ Re-Sign</button>
              <button class="op-btn op-btn-primary" onclick="executeApiCall()">▶ Send Signed Request</button>
            </div>
          </div>
          <p id="cur-desc" style="font-size:12px;color:#475569;margin-bottom:12px"></p>

          <div class="op-sign-banner">
            <div><strong>HMAC-SHA256 Base String:</strong> <code id="sig-base-preview">...</code></div>
            <div style="margin-top:4px"><strong>Computed Signature (<code>sign</code>):</strong> <code id="sig-hex-preview">...</code></div>
          </div>

          <div class="op-form-grid">
            <div class="op-field">
              <label>Partner ID</label>
              <input type="number" id="req-partner-id" class="op-mono" value="1" oninput="refreshSignaturePreview()">
            </div>
            <div class="op-field">
              <label>Partner Key (Secret)</label>
              <input type="text" id="req-partner-key" class="op-mono" value="1" oninput="refreshSignaturePreview()">
            </div>
            <div class="op-field">
              <label>Shop ID</label>
              <input type="number" id="req-shop-id" class="op-mono" value="222" oninput="refreshSignaturePreview()">
            </div>
            <div class="op-field">
              <label>Access Token (<a href="javascript:void(0)" onclick="quickGetToken()" style="color:#EE4D2D">Get New Token</a>)</label>
              <input type="text" id="req-access-token" class="op-mono" value="MOCK_CONSOLE_ACCESS_TOKEN" oninput="refreshSignaturePreview()">
            </div>
          </div>

          <div class="op-field" style="margin-bottom:10px">
            <label id="payload-label">Request Query Params / JSON Body (JSON format)</label>
            <textarea id="req-payload" rows="7" class="op-mono" style="font-size:12px"></textarea>
          </div>

          <details style="margin-top:8px">
            <summary style="cursor:pointer;font-size:12px;font-weight:600;color:#475569">View Schema Parameter Reference &amp; Python SDK Code Snippet</summary>
            <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div style="max-height:220px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:6px">
                <table class="op-table">
                  <thead><tr><th>Parameter</th><th>Type</th><th>Req</th><th>Description</th></tr></thead>
                  <tbody id="cur-param-table"></tbody>
                </table>
              </div>
              <div>
                <div style="font-size:11px;font-weight:600;color:#475569;margin-bottom:4px">Python SDK (<code>shopee_client.py</code>) Snippet:</div>
                <pre class="op-code-box" id="cur-python-snippet" style="max-height:195px;padding:10px;font-size:11px"></pre>
              </div>
            </div>
          </details>
        </div>

        <!-- Response Card -->
        <div class="op-card" style="margin-bottom:0;flex:1">
          <div class="op-card-title">
            <span>API Response</span>
            <span id="resp-meta" style="font-size:12px;font-weight:500;color:#64748b">Click "▶ Send Signed Request" to test</span>
          </div>
          <div id="resp-pdf-container" style="display:none;margin-bottom:12px">
            <iframe id="resp-pdf-frame" style="width:100%;height:420px;border:1px solid #cbd5e1;border-radius:6px"></iframe>
          </div>
          <pre class="op-code-box" id="resp-box">// Response JSON will appear here...</pre>
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 2: OAUTH & APP CREDENTIALS -->
  <div id="sec-oauth" style="display:none">
    <div class="op-card">
      <div class="op-card-title">
        <span>OAuth 2.0 Store Authorization &amp; Token Generator</span>
        <div style="display:flex;gap:8px">
          <a class="op-btn op-btn-outline" href="/auth?partner_id=1&redirect_uri=http://localhost:3000/console" target="_blank">🔗 Open Visual Store Authorize Page (/auth)</a>
          <button class="op-btn op-btn-primary" onclick="quickGetToken()">⚡ Exchange Auth Code for Access Token</button>
          <button class="op-btn op-btn-dark" onclick="quickRefreshToken()">↻ Refresh Access Token</button>
        </div>
      </div>
      <p style="font-size:12px;color:#475569;margin-bottom:14px">
        Test the complete Shopee v2 OAuth 2.0 handshake (<code>POST /api/v2/auth/token/get</code> and <code>POST /api/v2/auth/access_token/get</code>). Any token generated here is automatically loaded into the API Test Tool.
      </p>
      <div class="op-form-grid">
        <div class="op-field">
          <label>Authorization Code (<code>code</code>)</label>
          <input type="text" id="oauth-code" class="op-mono" value="MOCK_AUTH_CODE_2026">
        </div>
        <div class="op-field">
          <label>Current <code>access_token</code></label>
          <input type="text" id="oauth-access-token" class="op-mono" readonly>
        </div>
        <div class="op-field">
          <label>Current <code>refresh_token</code></label>
          <input type="text" id="oauth-refresh-token" class="op-mono" readonly>
        </div>
        <div class="op-field">
          <label>Token Expiry (<code>expire_in</code>)</label>
          <input type="text" id="oauth-expire" class="op-mono" value="14400s (4 hours)" readonly>
        </div>
      </div>
      <pre class="op-code-box" id="oauth-result-box">// Click "Exchange Auth Code for Access Token" to inspect the raw OAuth token response.</pre>
    </div>
  </div>

  <!-- SECTION 3: PYTHON SDK RUNNER -->
  <div id="sec-python" style="display:none">
    <div class="op-card">
      <div class="op-card-title">
        <span>Python Shopee v2 SDK — Live End-to-End Test Runner (<code>python-shopee-sdk/test_app.py</code>)</span>
        <button class="op-btn op-btn-green" id="btn-run-py" onclick="runPythonTestSuite()">▶ Run All 8 Python SDK Test Suites Now</button>
      </div>
      <p style="font-size:12px;color:#475569;margin-bottom:12px">
        Executes <code>/home/nguyentnt/MMVI/shop/python-shopee-sdk/test_app.py</code> directly against this server with strict HMAC-SHA256 verification and streams the output below:
      </p>
      <pre class="op-code-box" id="py-output-box" style="min-height:380px">Click "▶ Run All 8 Python SDK Test Suites Now" to execute test_app.py...</pre>
    </div>
  </div>

  <!-- SECTION 4: LIVE REQUEST LOGS -->
  <div id="sec-logs" style="display:none">
    <div class="op-card">
      <div class="op-card-title">
        <span>Live API v2 Request Inspector (Last 40 Calls)</span>
        <div style="display:flex;gap:8px">
          <button class="op-btn op-btn-outline" onclick="loadMeta()">↻ Refresh Logs</button>
          <button class="op-btn op-btn-outline" onclick="clearLogs()">Clear Logs</button>
        </div>
      </div>
      <table class="op-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Method</th>
            <th>Endpoint Path</th>
            <th>Status</th>
            <th>Latency</th>
            <th>Query / Body</th>
          </tr>
        </thead>
        <tbody id="logs-tbody"></tbody>
      </table>
    </div>
  </div>
</div>

<script>
let META = null;
let CATALOG = [];
let CURRENT_EP = null;

const PRESET_PAYLOADS = {
  '/api/v2/auth/token/get': { code: 'MOCK_AUTH_CODE_2026', partner_id: 1, shop_id: 222 },
  '/api/v2/auth/access_token/get': { refresh_token: 'MOCK_REFRESH_TOKEN', partner_id: 1, shop_id: 222 },
  '/api/v2/shop/get_shop_info': {},
  '/api/v2/shop/update_profile': { shop_name: 'Demo Shopee Store PH', description: 'Updated from Open Platform Console' },
  '/api/v2/product/get_item_list': { offset: 0, page_size: 20, item_status: 'NORMAL' },
  '/api/v2/product/get_item_base_info': { item_id_list: [10001, 10002] },
  '/api/v2/product/add_item': {
    item_name: 'Console Test Wireless Earbuds',
    description: 'Added from Shopee Open Platform Console UI',
    category_id: 100001,
    original_price: 1299,
    item_sku: 'CONSOLE-EARBUDS-01',
    weight: 0.25,
    seller_stock: [{ stock: 60 }]
  },
  '/api/v2/product/update_stock': {
    item_id: 10001,
    stock_list: [{ model_id: 0, seller_stock: [{ stock: 95 }] }]
  },
  '/api/v2/order/get_order_list': {
    time_range_field: 'create_time',
    time_from: Math.floor(Date.now() / 1000) - 86400 * 7,
    time_to: Math.floor(Date.now() / 1000),
    page_size: 20
  },
  '/api/v2/order/get_order_detail': { order_sn_list: ['SPX20260521001'] },
  '/api/v2/logistics/get_shipping_parameter': { order_sn: 'SPX20260521001' },
  '/api/v2/logistics/ship_order': {
    order_sn: 'SPX20260521001',
    pickup: { address_id: 1, pickup_time_id: 'slot_001' }
  },
  '/api/v2/logistics/download_shipping_document': {
    order_list: [{ order_sn: 'SPX20260521001' }]
  },
  '/api/v2/payment/get_escrow_detail': { order_sn: 'SPX20260521001' },
  '/api/v2/voucher/get_voucher_list': { status: 'all', page_no: 1, page_size: 20 }
};

function showSection(name, btn) {
  ['explorer', 'oauth', 'python', 'logs'].forEach(s => {
    document.getElementById('sec-' + s).style.display = (s === name) ? 'block' : 'none';
  });
  document.querySelectorAll('.op-nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (name === 'logs') loadMeta();
}

async function loadMeta() {
  const res = await fetch('/api/console/meta');
  META = await res.json();
  CATALOG = META.catalog || [];

  document.getElementById('st-endpoints').textContent = META.counts.endpoints;
  document.getElementById('st-partner').textContent = META.partner_id;
  document.getElementById('st-shop').textContent = META.shop_id + ' (' + META.region + ')';
  document.getElementById('st-data').textContent = META.counts.products + ' / ' + META.counts.orders;
  document.getElementById('st-sig').textContent = META.strict_sig ? 'STRICT (ON)' : 'PERMISSIVE';

  document.getElementById('req-partner-id').value = META.partner_id;
  document.getElementById('req-partner-key').value = META.partner_key;
  document.getElementById('req-shop-id').value = META.shop_id;

  // Populate modules dropdown
  const modSelect = document.getElementById('ep-module');
  if (modSelect.options.length <= 1) {
    const modCounts = {};
    CATALOG.forEach(ep => { modCounts[ep.module] = (modCounts[ep.module] || 0) + 1; });
    Object.keys(modCounts).sort().forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m + ' (' + modCounts[m] + ')';
      modSelect.appendChild(opt);
    });
  }

  renderEndpointList();
  renderLogs(META.logs || []);
  if (!CURRENT_EP && CATALOG.length) {
    selectByPath('/api/v2/shop/get_shop_info');
  }
}

function renderEndpointList() {
  const q = document.getElementById('ep-search').value.trim().toLowerCase();
  const mod = document.getElementById('ep-module').value;
  const listEl = document.getElementById('ep-list');

  const filtered = CATALOG.filter(ep => {
    if (mod !== 'all' && ep.module !== mod) return false;
    if (!q) return true;
    return ep.api_name.toLowerCase().includes(q) || ep.path.toLowerCase().includes(q) || ep.description.toLowerCase().includes(q);
  });

  listEl.innerHTML = filtered.map(ep => {
    const isAct = CURRENT_EP && CURRENT_EP.path === ep.path;
    return '<div class="op-ep-item ' + (isAct ? 'active' : '') + '" onclick="selectByPath(\\'' + ep.path + '\\')">' +
      '<div class="op-ep-top">' +
        '<span class="op-method ' + ep.method + '">' + ep.method + '</span>' +
        '<span class="op-ep-name">' + ep.api_name + '</span>' +
      '</div>' +
      '<div class="op-ep-path">' + ep.path + '</div>' +
    '</div>';
  }).join('');
}

function selectByPath(apiPath) {
  let ep = CATALOG.find(e => e.path === apiPath);
  if (!ep) {
    ep = {
      api_name: 'v2.' + apiPath.replace('/api/v2/', '').replace(/\\//g, '.'),
      module: apiPath.split('/')[3] || 'auth',
      method: apiPath.includes('/auth/') ? 'POST' : 'GET',
      path: apiPath,
      api_type: apiPath.includes('/auth/') || apiPath.includes('/public/') ? 'Public' : 'Shop',
      description: 'Shopee Open Platform v2 endpoint ' + apiPath,
      sample_request: PRESET_PAYLOADS[apiPath] || {},
      param_docs: []
    };
  }
  CURRENT_EP = ep;
  renderEndpointList();

  const mEl = document.getElementById('cur-method');
  mEl.textContent = ep.method;
  mEl.className = 'op-method ' + ep.method;
  document.getElementById('cur-path').textContent = ep.path;
  document.getElementById('cur-name').textContent = '(' + ep.api_name + ' · ' + ep.api_type + ' API)';
  document.getElementById('cur-desc').textContent = ep.description;
  document.getElementById('payload-label').textContent =
    ep.method === 'GET' ? 'Query Parameters (JSON key-value object)' : 'POST Request Body (JSON object)';

  const sample = PRESET_PAYLOADS[ep.path] !== undefined ? PRESET_PAYLOADS[ep.path] : (ep.sample_request || {});
  document.getElementById('req-payload').value = JSON.stringify(sample, null, 2);

  // Render param table
  const tbody = document.getElementById('cur-param-table');
  if (ep.param_docs && ep.param_docs.length) {
    tbody.innerHTML = ep.param_docs.map(p =>
      '<tr><td class="op-mono"><strong>' + p.name + '</strong></td><td>' + p.type + '</td><td>' +
      (p.required ? '<span style="color:#EE4D2D;font-weight:700">Yes</span>' : 'No') +
      '</td><td>' + p.description + '</td></tr>'
    ).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#94a3b8">No additional parameters required.</td></tr>';
  }

  // Render Python SDK snippet
  const shortPath = ep.path.replace(/^\\/api\\/v2/, '');
  const isPublic = ep.api_type === 'Public' || ep.path.includes('/auth/') || ep.path.includes('/public/');
  const pyCode = [
    'from shopee_client import ShopeeClient',
    '',
    'client = ShopeeClient(',
    '    partner_id=' + document.getElementById('req-partner-id').value + ',',
    '    partner_key="' + document.getElementById('req-partner-key').value + '",',
    '    shop_id=' + document.getElementById('req-shop-id').value + ',',
    '    base_url="' + window.location.origin + '/api/v2",',
    ')',
    'client.authenticate_with_code("MOCK_AUTH_CODE_2026")',
    '',
    'response = client.request(',
    '    "' + ep.method + '",',
    '    "' + shortPath + '",',
    '    ' + (ep.method === 'GET' ? 'params=' : 'body=') + JSON.stringify(sample) + ',',
    '    auth=' + (isPublic ? 'False' : 'True') + ',',
    ')',
    'print(response)'
  ].join('\\n');
  document.getElementById('cur-python-snippet').textContent = pyCode;

  refreshSignaturePreview();
}

async function refreshSignaturePreview() {
  if (!CURRENT_EP) return null;
  const partner_id = document.getElementById('req-partner-id').value;
  const partner_key = document.getElementById('req-partner-key').value;
  const shop_id = document.getElementById('req-shop-id').value;
  const access_token = document.getElementById('req-access-token').value;
  const isPublic = CURRENT_EP.api_type === 'Public' || CURRENT_EP.path.includes('/auth/') || CURRENT_EP.path.includes('/public/');

  const res = await fetch('/api/console/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partner_id,
      partner_key,
      api_path: CURRENT_EP.path,
      access_token,
      shop_id,
      auth: !isPublic,
    }),
  });
  const sigData = await res.json();
  document.getElementById('sig-base-preview').textContent = sigData.base_string;
  document.getElementById('sig-hex-preview').textContent = sigData.sign;
  return sigData;
}

async function executeApiCall() {
  if (!CURRENT_EP) return;
  const sigData = await refreshSignaturePreview();
  const shop_id = document.getElementById('req-shop-id').value;
  const access_token = document.getElementById('req-access-token').value;

  let payload = {};
  try {
    const raw = document.getElementById('req-payload').value.trim();
    if (raw) payload = JSON.parse(raw);
  } catch (e) {
    alert('Invalid JSON in Request Payload: ' + e.message);
    return;
  }

  const params = new URLSearchParams();
  if (CURRENT_EP.method === 'GET') {
    Object.entries(payload).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(item => params.append(k, String(item)));
      else if (v !== undefined && v !== null) params.append(k, String(v));
    });
  }
  params.set('partner_id', String(sigData.partner_id));
  params.set('timestamp', String(sigData.timestamp));
  if (sigData.auth) {
    params.set('access_token', access_token);
    params.set('shop_id', String(shop_id));
  }
  params.set('sign', sigData.sign);

  const fullUrl = CURRENT_EP.path + '?' + params.toString();
  const start = performance.now();
  const fetchOpts = {
    method: CURRENT_EP.method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (CURRENT_EP.method !== 'GET') {
    fetchOpts.body = JSON.stringify(payload);
  }

  document.getElementById('resp-pdf-container').style.display = 'none';
  document.getElementById('resp-box').textContent = 'Sending request to ' + fullUrl + '...';

  try {
    const resp = await fetch(fullUrl, fetchOpts);
    const ms = Math.round(performance.now() - start);
    const ctype = resp.headers.get('content-type') || '';
    document.getElementById('resp-meta').textContent =
      'HTTP ' + resp.status + ' · ' + ms + ' ms · ' + ctype;

    if (ctype.includes('application/pdf')) {
      const blob = await resp.blob();
      const pdfUrl = URL.createObjectURL(blob);
      document.getElementById('resp-pdf-container').style.display = 'block';
      document.getElementById('resp-pdf-frame').src = pdfUrl;
      document.getElementById('resp-box').textContent =
        '✅ Received binary PDF airway bill (' + blob.size + ' bytes). Preview rendered above.';
    } else {
      const data = await resp.json();
      document.getElementById('resp-box').textContent = JSON.stringify(data, null, 2);
    }
    loadMeta();
  } catch (err) {
    document.getElementById('resp-box').textContent = 'Request Error: ' + err.message;
  }
}

async function quickGetToken() {
  const partner_id = Number(document.getElementById('req-partner-id').value || 1);
  const partner_key = document.getElementById('req-partner-key').value || '1';
  const shop_id = Number(document.getElementById('req-shop-id').value || 222);
  const code = document.getElementById('oauth-code').value || 'MOCK_AUTH_CODE_2026';

  const sigRes = await fetch('/api/console/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partner_id, partner_key, api_path: '/api/v2/auth/token/get', auth: false }),
  });
  const sig = await sigRes.json();
  const url = '/api/v2/auth/token/get?partner_id=' + partner_id + '&timestamp=' + sig.timestamp + '&sign=' + sig.sign;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, partner_id, shop_id }),
  });
  const data = await resp.json();
  if (data.access_token) {
    document.getElementById('req-access-token').value = data.access_token;
    document.getElementById('oauth-access-token').value = data.access_token;
    document.getElementById('oauth-refresh-token').value = data.refresh_token;
    document.getElementById('top-token-status').textContent = 'Token: ' + data.access_token.slice(0, 18) + '...';
  }
  document.getElementById('oauth-result-box').textContent = JSON.stringify(data, null, 2);
  refreshSignaturePreview();
}

async function quickRefreshToken() {
  const partner_id = Number(document.getElementById('req-partner-id').value || 1);
  const partner_key = document.getElementById('req-partner-key').value || '1';
  const shop_id = Number(document.getElementById('req-shop-id').value || 222);
  const refresh_token = document.getElementById('oauth-refresh-token').value || 'MOCK_REFRESH_TOKEN';

  const sigRes = await fetch('/api/console/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partner_id, partner_key, api_path: '/api/v2/auth/access_token/get', auth: false }),
  });
  const sig = await sigRes.json();
  const url = '/api/v2/auth/access_token/get?partner_id=' + partner_id + '&timestamp=' + sig.timestamp + '&sign=' + sig.sign;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token, partner_id, shop_id }),
  });
  const data = await resp.json();
  if (data.access_token) {
    document.getElementById('req-access-token').value = data.access_token;
    document.getElementById('oauth-access-token').value = data.access_token;
    document.getElementById('oauth-refresh-token').value = data.refresh_token;
    document.getElementById('top-token-status').textContent = 'Token: ' + data.access_token.slice(0, 18) + '...';
  }
  document.getElementById('oauth-result-box').textContent = JSON.stringify(data, null, 2);
  refreshSignaturePreview();
}

async function runPythonTestSuite() {
  const btn = document.getElementById('btn-run-py');
  const box = document.getElementById('py-output-box');
  btn.disabled = true;
  btn.textContent = '⏳ Running Python SDK Tests...';
  box.textContent = 'Starting python3 test_app.py against ' + window.location.origin + '/api/v2 ...\\n';

  try {
    const res = await fetch('/api/console/run-python-tests', { method: 'POST' });
    const data = await res.json();
    box.textContent = (data.stdout || '') + (data.stderr ? '\\n' + data.stderr : '');
    loadMeta();
  } catch (err) {
    box.textContent = 'Failed to run Python tests: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Run All 8 Python SDK Test Suites Now';
  }
}

function renderLogs(logs) {
  const tbody = document.getElementById('logs-tbody');
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#94a3b8">No API requests recorded yet.</td></tr>';
    return;
  }
  tbody.innerHTML = logs.map(l =>
    '<tr>' +
      '<td class="op-mono" style="white-space:nowrap">' + l.time + '</td>' +
      '<td><span class="op-method ' + l.method + '">' + l.method + '</span></td>' +
      '<td class="op-mono"><strong>' + l.path + '</strong></td>' +
      '<td><span style="font-weight:700;color:' + (l.status < 400 ? '#16a34a' : '#dc2626') + '">' + l.status + '</span></td>' +
      '<td class="op-mono">' + l.duration_ms + ' ms</td>' +
      '<td class="op-mono" style="font-size:11px;max-width:480px;word-break:break-all">' +
        (l.body ? 'body: ' + JSON.stringify(l.body) : 'query: ' + JSON.stringify(l.query)) +
      '</td>' +
    '</tr>'
  ).join('');
}

async function clearLogs() {
  await fetch('/api/console/clear-logs', { method: 'POST' });
  loadMeta();
}

loadMeta();
</script>
</body>
</html>`);
  });
}

module.exports = {
  registerConsoleRoutes,
};
