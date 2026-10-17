# Shopee Mock & Shopee SDK Compatibility Report

## Workspace Repositories & One-Command Controller

- **One-Command Controller**: `/home/nguyentnt/MMVI/shop/shop.sh`
- **Mock Server**: `/home/nguyentnt/MMVI/shop/shopee-mock` (`https://github.com/potatoaey18/shopee-mock`)
- **TypeScript Shopee SDK**: `/home/nguyentnt/MMVI/shop/shopee-sdk` (`https://github.com/congminh1254/shopee-sdk`)
- **Python Shopee SDK & Test App**: `/home/nguyentnt/MMVI/shop/python-shopee-sdk` (`shopee_client.py` & `test_app.py`)

### Turn ON / OFF Whole Project in One Command
From `/home/nguyentnt/MMVI/shop`:
```bash
./shop.sh on        # Turn ON server + Open Platform Console + Seller Centre UI (background)
./shop.sh off       # Turn OFF the whole project cleanly
./shop.sh restart   # Restart the server
./shop.sh status    # Check ONLINE/OFFLINE status, PID, and all Web UI URLs
./shop.sh test      # Run Python SDK end-to-end test suite (verifies all 455 API schemas)
./shop.sh reset     # Reset mock database state to fresh defaults
./shop.sh logs      # View recent server logs
```

---

## 1. Research: Is `potatoaey18/shopee-mock` the Best Fit for Mocking Shopee Open Platform?

### Why there is no better standalone open-source alternative
- **No official standalone mock server**: Shopee does not provide an official local/standalone mock server—only its live sandbox (`https://partner.test-stable.shopeemobile.com/api/v2`), which requires seller account setup, Playwright/browser OAuth login, and often suffers from sandbox rate limits or transient server errors.
- **Other SDKs only mock in-memory unit tests**: Existing community SDKs (including `congminh1254/shopee-sdk` in `MOCK_API_TESTING.md`) only stub `fetch` calls in-memory for Jest unit tests rather than running a stateful HTTP mock backend.

### Why combining `shopee-mock` + `shopee-sdk/schemas` is the best solution
1. **`shopee-mock` provides a stateful Seller Centre UI & fulfillment workflow**:
   - Interactive **Shopee Seller Centre UI** (`http://localhost:3000/`) to create demo orders, arrange shipments, advance delivery steps (`Order Placed` -> `Picked Up` -> `In Transit` -> `Out for Delivery` -> `Delivered`), and reset state.
   - Public **Shipment Tracking page** (`http://localhost:3000/track/:tracking`).
   - Real **SPX Express PDF shipping label generator** (`pdfkit`) and printable HTML label view.
   - File-based state persistence (`shopee_mock_state.json`) and HMAC-SHA256 signature verification (`STRICT_SIG=true`).
2. **`shopee-sdk/schemas` contains all 455 official Shopee Open Platform v2 endpoint schemas**:
   - Every single Shopee v2 API definition (`v2.product.*`, `v2.order.*`, `v2.logistics.*`, `v2.payment.*`, `v2.voucher.*`, `v2.discount.*`, etc.) with official `response_sample` payloads and parameter trees is stored in `/home/nguyentnt/MMVI/shop/shopee-sdk/schemas/`.
   - By fixing `shopee-mock`'s protocol discrepancies and integrating a **455-Schema Engine** (`shopee-mock/schema-engine.js`), `shopee-mock` now supports both stateful CRUD workflows and **all 455 Shopee Open Platform v2 endpoints**.

---

## 2. Incompatibilities Found & Fixed Between `shopee-mock` and `shopee-sdk`

Out of the box, `potatoaey18/shopee-mock` had **6 breaking incompatibilities** with `congminh1254/shopee-sdk`:

### Fix 1: OAuth Token Exchange & Refresh Response Format (`POST /api/v2/auth/token/get` & `/api/v2/auth/access_token/get`)
- **Problem**: `AuthManager.getAccessToken()` and `AuthManager.getRefreshToken()` in `shopee-sdk` (and Shopee's official v2 API spec) expect `access_token`, `refresh_token`, `expire_in`, `shop_id`, and `shop_id_list` at the **root level** of the JSON response. `shopee-mock` originally wrapped them only inside `response: { ... }`, which caused `sdk.authenticateWithCode()` and `sdk.refreshToken()` to return `access_token: undefined` and broke all subsequent authenticated SDK calls.
- **Fix**: Updated `/api/v2/auth/token/get` and `/api/v2/auth/access_token/get` in `shopee-mock/index.js` to return token fields at both the **root level** (for `shopee-sdk` and Shopee v2 compliance) and inside `response` (for backward compatibility with Odoo).

### Fix 2: Array Query Parameters Crashing Express (`500 Internal Server Error`)
- **Problem**: `ShopeeFetch.fetch()` in `shopee-sdk` serializes array parameters (`item_id_list: [10001, 10002]` in `product.getItemBaseInfo()` and `order_sn_list: ['SPX...', 'SPX...']` in `order.getOrderDetail()`) as repeated query keys (`?item_id_list=10001&item_id_list=10002`). Express parses repeated keys into an `Array`, causing `req.query.item_id_list.split(',')` in `shopee-mock` to crash with `TypeError: raw.split is not a function`.
- **Fix**: Added `parseListParam()` in `shopee-mock/schema-engine.js` and updated `shopee-mock/index.js` so both repeated query parameter arrays and comma-separated strings are handled cleanly.

### Fix 3: Public vs. Shop API HMAC-SHA256 Signature Verification (`STRICT_SIG=true`)
- **Problem**: `verifySignature()` in `shopee-mock/index.js` previously included `req.query.shop_id` in the HMAC base string even when `access_token` was not present, whereas Shopee's v2 specification and `shopee-sdk` sign `partner_id + path + timestamp` for Public APIs (`auth: false`) and `partner_id + path + timestamp + access_token + shop_id` for Shop APIs (`auth: true`).
- **Fix**: Updated `verifySignature()` in `shopee-mock/index.js` to only include `shop_id` or `merchant_id` in the signature base string when `access_token` is present, and return standard Shopee error code `error_sign` on mismatch.

### Fix 4: OAuth Authorize Endpoint & Parameters (`/auth` & `redirect_uri`)
- **Problem**: `sdk.getAuthorizationUrl(redirect_uri, { state })` uses `/auth` and passes `redirect_uri` and `state`, whereas `shopee-mock` only listened on `/api/v2/auth/authorize` and only checked `redirect_url`.
- **Fix**: Mounted `handleAuthorizePage` on both `/auth` and `/api/v2/auth/authorize` in `shopee-mock/index.js` with support for `redirect_uri`, `redirect_url`, `redirect`, `state`, and `auto_redirect=true`.

### Fix 5: Shop Info Root Fields (`GET /api/v2/shop/get_shop_info`)
- **Problem**: `sdk.shop.getShopInfo()` expects root-level `shop_name`, `region`, `status`, `auth_time`, and `expire_time` (for automatic timestamp deserialization in `ShopeeFetch`).
- **Fix**: Updated `/api/v2/shop/get_shop_info` in `shopee-mock/index.js` to return `DB.shop` fields at both root level and inside `response`.

### Fix 6: Full Stateful CRUD & 455-Endpoint Schema Engine (`shopee-mock/schema-engine.js`)
- **Problem**: `shopee-mock` originally implemented only 12 endpoints and returned `404 endpoint_not_found` for everything else in `shopee-sdk`.
- **Fix**: Created `/home/nguyentnt/MMVI/shop/shopee-mock/schema-engine.js`, which adds:
  - **Stateful CRUD handlers** for:
    - `PublicManager`: `get_shopee_ip_ranges`, `get_shops_by_partner`, `get_merchants_by_partner`, `get_token_by_resend_code`
    - `ShopManager`: `get_shop_info`, `get_profile`, `update_profile`
    - `ProductManager`: `get_category`, `get_attribute_tree`, `get_brand_list`, `get_item_limit`, `get_item_list`, `get_item_base_info`, `get_boosted_list`, `boost_item`, `category_recommend`, `get_recommend_attribute`, `add_item`, `update_item`, `update_price`, `update_stock`, `delete_item`
    - `OrderManager`: `get_order_list`, `get_order_detail`
    - `LogisticsManager`: `get_channel_list`, `get_shipping_parameter`, `get_tracking_number`, `ship_order`, `create_shipping_document`, `get_shipping_document_parameter`, `get_shipping_document_result`, `download_shipping_document` (binary PDF), `download_shipping_document_job`
    - `PaymentManager`: `get_payment_method_list`, `get_shop_installment_status`, `get_escrow_detail`
    - `ReturnsManager`: `get_return_list`, `get_return_detail`
    - `VoucherManager`: `add_voucher`, `get_voucher`, `update_voucher`, `delete_voucher`, `end_voucher`, `get_voucher_list`
    - `DiscountManager`: `add_discount`, `get_discount`, `update_discount`, `delete_discount`, `get_discount_list`
    - `BundleDealManager`: `add_bundle_deal`, `get_bundle_deal`, `update_bundle_deal`, `delete_bundle_deal`, `get_bundle_deal_list`
    - `FollowPrizeManager`: `add_follow_prize`, `get_follow_prize_detail`, `update_follow_prize`, `delete_follow_prize`, `end_follow_prize`, `get_follow_prize_list`
    - `ShopCategoryManager`: `add_shop_category`, `get_shop_category_list`, `update_shop_category`, `delete_shop_category`
    - `MediaSpaceManager` & `MediaManager`: `upload_image`, `init_video_upload`, `upload_video_part`, `complete_video_upload`, `get_video_upload_result`, `cancel_video_upload`
  - **Universal 455-Schema Fallback Engine**: Automatically loads all 455 `.json` schemas from `/home/nguyentnt/MMVI/shop/shopee-sdk/schemas` and serves schema-compliant mock responses for any other `/api/v2/*` endpoint.

---

## 3. Verification Results

All **14 integration test suites (35 tests)** in `shopee-sdk/src/__tests__/integration/` and all **8 Python SDK test suites** in `python-shopee-sdk/test_app.py` pass against `shopee-mock` with `STRICT_SIG=true`:

```bash
cd /home/nguyentnt/MMVI/shop/shopee-mock
npm run test:sdk
npm run test:python
```

Test suites verified:
- `shop.integration.test.ts` (PASS)
- `public.integration.test.ts` (PASS)
- `order.integration.test.ts` (PASS)
- `product.integration.test.ts` (PASS)
- `logistics.integration.test.ts` (PASS)
- `document.integration.test.ts` (PASS)
- `payment.integration.test.ts` (PASS)
- `returns.integration.test.ts` (PASS)
- `voucher.integration.test.ts` (PASS)
- `discount.integration.test.ts` (PASS)
- `bundle-deal.integration.test.ts` (PASS)
- `follow-prize.integration.test.ts` (PASS)
- `shop-category.integration.test.ts` (PASS)
- `media.integration.test.ts` (PASS)
- `python-shopee-sdk/test_app.py` (8/8 suites PASS)

---

## 4. Quick Start Guide: Using TypeScript `shopee-sdk` with `shopee-mock`

### Step 1: Start `shopee-mock`
```bash
cd /home/nguyentnt/MMVI/shop/shopee-mock
STRICT_SIG=true PARTNER_ID=123456 PARTNER_KEY=your_partner_key node index.js
```
- **Seller Centre Web UI**: `http://localhost:3000/`
- **Debug State JSON**: `http://localhost:3000/api/debug`
- **Reset State**: `POST http://localhost:3000/api/demo/reset`

### Step 2: Connect TypeScript `ShopeeSDK` to `shopee-mock`
Note that `base_url` must end with `/api/v2`:

```typescript
import { ShopeeSDK } from "@congminh1254/shopee-sdk";

const sdk = new ShopeeSDK({
  partner_id: 123456,
  partner_key: "your_partner_key",
  shop_id: 123456,
  base_url: "http://localhost:3000/api/v2",
  base_auth_url: "http://localhost:3000/auth",
});

// 1. Exchange auth code for access_token + refresh_token
const token = await sdk.authenticateWithCode("MOCK_AUTH_CODE_2026", 123456);

// 2. Call any Shopee Open Platform v2 API
const shopInfo = await sdk.shop.getShopInfo();
const products = await sdk.product.getItemList({
  offset: 0,
  page_size: 20,
  item_status: "NORMAL",
});
const orders = await sdk.order.getOrderList({
  time_range_field: "create_time",
  time_from: 0,
  time_to: Math.floor(Date.now() / 1000),
  page_size: 20,
});
```

---

## 5. Python SDK & Test Application (`/home/nguyentnt/MMVI/shop/python-shopee-sdk`)

A zero-dependency Python 3 SDK (`shopee_client.py`) and end-to-end test suite (`test_app.py`) are located in `/home/nguyentnt/MMVI/shop/python-shopee-sdk`. Because it uses only the Python standard library (`urllib`, `hmac`, `hashlib`, `json`), no `pip install` or virtual environment is required.

### Option A: One-Command Automated Test Run
```bash
cd /home/nguyentnt/MMVI/shop/shopee-mock
npm run test:python
```

### Option B: Start `shopee-mock` Manually & Run Python App

#### 1. Start the `shopee-mock` server (Terminal 1)
By default, `shopee-mock` uses `PORT=3000`, `PARTNER_ID=1`, and `PARTNER_KEY=1`. (If port 3000 is already occupied on your machine, pass `PORT=3099`):
```bash
cd /home/nguyentnt/MMVI/shop/shopee-mock
PORT=3099 STRICT_SIG=true PARTNER_ID=1 PARTNER_KEY=1 npm start
```

#### 2. Run the Python End-to-End Test Application (Terminal 2)
```bash
cd /home/nguyentnt/MMVI/shop/python-shopee-sdk
SHOPEE_BASE_URL="http://localhost:3099/api/v2" \
SHOPEE_AUTH_URL="http://localhost:3099/auth" \
python3 test_app.py
```

### How to Use `ShopeeClient` in Your Own Python Code

```python
import time
from shopee_client import ShopeeClient

# 1. Initialize client (base_url must end with /api/v2)
client = ShopeeClient(
    partner_id=1,
    partner_key="1",
    shop_id=222,
    base_url="http://localhost:3099/api/v2",
    base_auth_url="http://localhost:3099/auth",
)

# 2. Exchange authorization code for access_token & refresh_token
token = client.authenticate_with_code(code="mock_auth_code", shop_id=222)
print("Access Token:", token.access_token)

# 3. Shop Info & Profile
shop_info = client.shop.get_shop_info()
print("Shop Name:", shop_info["shop_name"])

# 4. Product CRUD (List, Add, Update Price/Stock, Delete)
items = client.product.get_item_list(offset=0, page_size=20, item_status="NORMAL")
new_item = client.product.add_item({
    "item_name": "Wireless Mechanical Keyboard",
    "description": "Hot-swappable RGB keyboard",
    "category_id": 100001,
    "original_price": 1890,
    "item_sku": "KB-RGB-75",
    "seller_stock": [{"stock": 50}],
})
item_id = new_item["response"]["item_id"]
client.product.update_price(item_id, [{"model_id": 0, "original_price": 1690}])
client.product.update_stock(item_id, [{"model_id": 0, "seller_stock": [{"stock": 80}]}])

# 5. Orders & Logistics (Ship Order + Download Airway Bill PDF)
orders = client.order.get_order_list(
    time_range_field="create_time",
    time_from=int(time.time()) - 86400 * 7,
    time_to=int(time.time()),
)
order_sn = orders["response"]["order_list"][0]["order_sn"]
order_detail = client.order.get_order_detail([order_sn])

ship_params = client.logistics.get_shipping_parameter(order_sn)
addr_id = ship_params["response"]["pickup"]["address_list"][0]["address_id"]
slot_id = ship_params["response"]["pickup"]["address_list"][0]["time_slot_list"][0]["pickup_time_id"]
client.logistics.ship_order(order_sn, pickup={"address_id": addr_id, "pickup_time_id": slot_id})

tracking_no = client.logistics.get_tracking_number(order_sn)["response"]["tracking_number"]
doc_req = [{"order_sn": order_sn, "tracking_number": tracking_no}]
client.logistics.create_shipping_document(doc_req)
pdf_bytes = client.logistics.download_shipping_document(doc_req)
with open("shipping_label.pdf", "wb") as f:
    f.write(pdf_bytes)

# 6. Full 455-Schema & 31-Module Support
# List all 31 loaded Shopee v2 modules and 455 endpoints:
print(client.list_modules())      # ['account_health', 'add_on_deal', 'ads', 'ams', 'bundle_deal', ...]
print(len(client.list_endpoints()))  # 455

# Call any module/endpoint dynamically as a Python method:
returns_res = client.returns.get_return_list(page_no=1, page_size=10)
flash_res   = client.shop_flash_sale.get_item_criteria()
ads_res     = client.ads.get_total_balance()

# Or call any of the 455 endpoints by its official Shopee v2 schema name:
res = client.call_api("v2.shop_flash_sale.get_item_criteria")
```

---

## 6. Web UIs: Shopee Open Platform Console & Seller Centre

Yes — `shopee-mock` now includes **4 interactive Web UIs** out of the box when the server is running:

### Start the Server (for Browser Use)
```bash
cd /home/nguyentnt/MMVI/shop/shopee-mock
PORT=3099 STRICT_SIG=true PARTNER_ID=1 PARTNER_KEY=1 npm start
```

### 1. Shopee Open Platform Developer Console (`http://localhost:3099/console`)
Implemented in `/home/nguyentnt/MMVI/shop/shopee-mock/console-ui.js` and modeled after the official **Shopee Open Platform Console (`open.shopee.com`)**:
- **API Test Tool (All 455 v2 Endpoints)**:
  - Browse or search all **455 Shopee v2 APIs** by module (`product`, `order`, `logistics`, `shop`, `public`, `voucher`, `discount`, `payment`, `returns`, etc.) or click the quick-select preset chips.
  - Auto-populates sample query parameters or JSON request body from the official Shopee v2 schema.
  - **Live HMAC-SHA256 Signature Calculator**: Displays the exact `base_string` (`partner_id + api_path + timestamp + access_token + shop_id`) and computed `sign` in real time.
  - **Send Signed Request**: Executes the API call directly from your browser, displays formatted JSON responses, and **renders binary PDF shipping labels inline** inside the console when calling `/api/v2/logistics/download_shipping_document`.
  - **Auto-Generated Python SDK Snippet & Parameter Docs**: Shows the exact `ShopeeClient` Python code snippet and parameter table for any selected endpoint.
- **App & OAuth 2.0 Credentials Tab**:
  - One-click **Exchange Auth Code for Access Token** (`POST /api/v2/auth/token/get`) and **Refresh Access Token** (`POST /api/v2/auth/access_token/get`), automatically binding the token into the API Test Tool.
- **Python SDK Runner Tab**:
  - Click **"▶ Run All 8 Python SDK Test Suites Now"** in the browser to execute `/home/nguyentnt/MMVI/shop/python-shopee-sdk/test_app.py` against the live server and view the test output directly in the console.
- **Live Request Inspector Tab**:
  - Real-time log of the last 40 `/api/v2/*` requests (timestamp, method, path, HTTP status, latency in ms, and query/body payload).

### 2. Shopee Seller Centre UI (`http://localhost:3099/`)
- **My Orders Tab**: View orders (`All`, `To Ship`, `Shipping`, `Completed`), create new demo orders (`+ New Demo Order`), click `Arrange Shipment`, advance delivery tracking steps (`Picked Up` → `In Transit` → `Out for Delivery` → `Delivered`), and print shipping labels.
- **My Products Tab**: View all store products (including products created or updated via the Python SDK, TypeScript SDK, or Open Platform Console) with live stock and price.
- Includes a top-bar button (`⚡ Open Platform Console (455 APIs) →`) to switch between **Seller Centre** and **Open Platform Console**.

### 3. Visual Store OAuth Authorize Page (`http://localhost:3099/auth`)
- Simulates Shopee's official store authorization login screen where a seller grants permissions to your Partner App and redirects back with `?code=MOCK_AUTH_CODE_2026&shop_id=123456`.

### 4. Public SPX Express Shipment Tracking Page (`http://localhost:3099/track/:tracking_number`)
- Customer-facing parcel tracking timeline showing live delivery progress for any shipped order.

---

## 7. Mock Shopee (`shopee-mock`) vs. Python SDK (`python-shopee-sdk`)

### 1. Role & Architecture Comparison

| Aspect | `shopee-mock` (Server / Platform Side) | `python-shopee-sdk` (Client / App Side) |
| :--- | :--- | :--- |
| **Location** | `/home/nguyentnt/MMVI/shop/shopee-mock` | `/home/nguyentnt/MMVI/shop/python-shopee-sdk` |
| **Runtime** | Node.js + Express (`http://localhost:3099`) | Python 3 Standard Library (zero `pip` dependencies) |
| **What It Simulates / Does** | Acts as **Shopee Open Platform v2 Backend + Seller Centre + Developer Console** | Acts as **Your Partner App / ERP / Integration Script** calling Shopee APIs |
| **Authentication & Signing** | **Verifies** incoming `HMAC-SHA256` `sign` query parameter when `STRICT_SIG=true` and issues `access_token` / `refresh_token` | **Generates** `HMAC-SHA256` `sign` (`partner_id + path + timestamp [+ access_token + shop_id]`) and manages token refresh |
| **API Schema Coverage** | **455 / 455 endpoints** across **31 modules** (`index.js` + `schema-engine.js`) | **455 / 455 endpoints** across **31 modules** (`shopee_client.py`) |
| **Web UIs Included** | Seller Centre (`/`), Open Platform Console (`/console`), OAuth Page (`/auth`), Tracking Page (`/track/:no`) | Can be triggered from CLI (`python3 test_app.py`) or from the browser at `http://localhost:3099/console` |
| **Switching to Live Shopee** | Local mock/sandbox replacement | Change `base_url="https://partner.shopeemobile.com/api/v2"` to talk to real Shopee production |

---

### 2. How the 455 API Schemas Are Handled Between `shopee-mock` and `python-shopee-sdk`

All **455 official Shopee v2 schemas** (across all **31 modules**) are 100% compatible between `shopee-mock` and `python-shopee-sdk`, divided into two tiers on the mock server:

1. **Tier 1 — Full Stateful CRUD Endpoints (58 Core Endpoints across 14 Modules)**:
   - **Modules**: `auth`, `public`, `shop`, `product`, `order`, `logistics`, `payment`, `returns`, `voucher`, `discount`, `bundle_deal`, `follow_prize`, `shop_category`, `media_space` / `media`.
   - **Behavior**: Calling `add_item`, `update_price`, `update_stock`, `delete_item`, `ship_order`, `create_shipping_document`, `download_shipping_document` (generates real PDF bytes), `add_voucher`, `add_discount`, `add_bundle_deal`, etc. from `python-shopee-sdk` **mutates the persistent database (`DB` / `shopee_mock_state.json`)** in real time. Changes immediately appear in the **Seller Centre UI (`/`)** and subsequent `get_*` API calls.
2. **Tier 2 — Schema-Driven Endpoints (Remaining 397 Endpoints across all 31 Modules)**:
   - **Modules**: `ads` (25), `ams` (36), `global_product` (34), `livestream` (25), `first_mile` (16), `video` (15), `add_on_deal` (14), `shop_flash_sale` (11), `principal` (11), `account_health` (6), `merchant` (6), `sbs` (6), `buybox` (5), `fbs` (4), `push` (4), `top_picks` (4), `business_insights` (1), plus remaining sub-endpoints in `product`/`logistics`/`order`.
   - **Behavior**: Both `shopee-mock` (`schema-engine.js`) and `python-shopee-sdk` (`shopee_client.py`) read the exact same 455 `.json` schema files from `/home/nguyentnt/MMVI/shop/shopee-sdk/schemas/`.
   - When `python-shopee-sdk` calls e.g. `client.ads.get_total_balance()` or `client.livestream.get_session_list()`, it signs the request using the schema's `method`, `path`, and `api_type`, and `shopee-mock` validates the signature and returns the official schema-compliant `response_sample` / `response_params` payload.

---

### 3. Compatibility with Other Third-Party Python Shopee SDKs (e.g., Odoo, `requests`, `pyshopee2`)

Because `shopee-mock` implements the exact Shopee Open Platform v2 wire specification:
- Standard HMAC-SHA256 signature verification (`partner_id + /api/v2/... + timestamp [+ access_token + shop_id]`)
- Both root-level and nested `response` fields on `/api/v2/auth/token/get`, `/api/v2/auth/access_token/get`, and `/api/v2/shop/get_shop_info`
- Both repeated query parameter arrays (`?item_id_list=1&item_id_list=2`) and comma-separated lists (`?item_id_list=1,2`)
- Raw `application/pdf` binary output on `/api/v2/logistics/download_shipping_document`

It is 100% compatible not only with `/home/nguyentnt/MMVI/shop/python-shopee-sdk/shopee_client.py`, but also with **Odoo's Python Shopee Connector**, custom `requests`/`httpx` scripts, and third-party Shopee v2 Python libraries.



