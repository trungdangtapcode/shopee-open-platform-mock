/**
 * Shopee Open Platform v2 — Stateful SDK Handlers & 455-Schema Fallback Engine
 *
 * Bridges potatoaey18/shopee-mock with congminh1254/shopee-sdk by:
 * 1. Implementing stateful CRUD endpoints for Product, Order, Logistics, Shop, Public,
 *    Voucher, Discount, BundleDeal, FollowPrize, ShopCategory, Returns, Payment, and Media/MediaSpace.
 * 2. Loading all 455 official Shopee v2 JSON schemas from ../shopee-sdk/schemas (if present)
 *    to automatically mock any remaining Shopee v2 API endpoint with schema-accurate responses.
 */

const fs = require('fs');
const path = require('path');

function buildFromParams(params) {
  const obj = {};
  for (const p of (params || [])) {
    if (['error', 'message', 'request_id', 'warning'].includes(p.name)) continue;
    const t = (p.type || '').toLowerCase();
    if (t.includes('[]')) {
      if (p.children && p.children.length) obj[p.name] = [buildFromParams(p.children)];
      else obj[p.name] = [];
    } else if (t === 'object' || (p.children && p.children.length)) {
      obj[p.name] = buildFromParams(p.children);
    } else if (t.includes('int') || t.includes('float') || t.includes('number') || t === 'timestamp') {
      obj[p.name] = Number(p.sample) || 0;
    } else if (t === 'boolean') {
      obj[p.name] = p.sample === 'true' || p.sample === true;
    } else {
      obj[p.name] = p.sample || '';
    }
  }
  return obj;
}

function loadShopeeSchemas(schemasDir) {
  const routeMap = new Map();
  if (!schemasDir || !fs.existsSync(schemasDir)) {
    return routeMap;
  }
  try {
    const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(schemasDir, file), 'utf8'));
        if (!raw.path) continue;
        let samplePayload = null;
        if (Array.isArray(raw.response_sample) && raw.response_sample.length > 0) {
          const val = raw.response_sample[0].value;
          if (typeof val === 'object' && val !== null) {
            samplePayload = val;
          } else if (typeof val === 'string') {
            try {
              samplePayload = JSON.parse(val);
            } catch (_) {}
          }
        }
        if (!samplePayload) {
          const generated = buildFromParams(raw.params && raw.params.response_params);
          samplePayload = {
            error: '',
            message: '',
            response: generated,
          };
        }
        routeMap.set(raw.path, {
          api_name: raw.api_name,
          method: raw.method === 1 ? 'POST' : 'GET',
          samplePayload,
        });
      } catch (_) {}
    }
    console.log(`[SCHEMA-ENGINE] Loaded ${routeMap.size} Shopee v2 endpoint schemas from ${schemasDir}`);
  } catch (err) {
    console.warn(`[SCHEMA-ENGINE] Could not load schemas:`, err.message);
  }
  return routeMap;
}

function parseListParam(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap(item => String(item).split(',')).map(s => s.trim()).filter(Boolean);
  }
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

function registerSdkRoutes(app, { DB, requireAuth, rid, ts, nowStr, saveState, schemasDir }) {
  // Initialize extended collections on DB if not present
  DB.categories = DB.categories || [
    { category_id: 100001, parent_category_id: 0, original_category_name: 'Health & Personal Care', display_category_name: 'Health & Personal Care', has_children: true },
    { category_id: 100002, parent_category_id: 100001, original_category_name: 'OTC Medicine & Supplements', display_category_name: 'OTC Medicine & Supplements', has_children: false },
    { category_id: 100003, parent_category_id: 0, original_category_name: 'Apparel & Accessories', display_category_name: 'Apparel & Accessories', has_children: false },
  ];
  DB.vouchers = DB.vouchers || [];
  DB.discounts = DB.discounts || [];
  DB.bundleDeals = DB.bundleDeals || [];
  DB.followPrizes = DB.followPrizes || [];
  DB.shopCategories = DB.shopCategories || [];
  DB.returns = DB.returns || [
    {
      return_sn: 'RET20260521001',
      order_sn: 'SPX20260521001',
      reason: 'DIFFERENT_DESCRIPTION',
      text_reason: 'Item packaging slightly dented',
      return_price: 185,
      currency: 'PHP',
      create_time: ts() - 3600,
      update_time: ts() - 1800,
      status: 'REQUESTED',
      amount_before_discount: 185,
      user: { username: 'juan_delacruz', email: 'juan@example.com', portrait: '' },
      item: [{ model_id: 0, name: 'Paracetamol 500mg Tablet (Box/100)', images: [], amount: 1, item_price: 185, is_add_on_deal: false, is_main_item: true, item_id: 10007, item_sku: 'FG-PARA-500', variation_sku: 'FG-PARA-500' }],
    },
  ];
  DB.videoUploads = DB.videoUploads || {};
  DB.boostedItems = DB.boostedItems || [];

  const schemaMap = loadShopeeSchemas(
    schemasDir || path.resolve(__dirname, '../shopee-sdk/schemas')
  );

  // ── PUBLIC ENDPOINTS ────────────────────────────────────────────────
  app.get('/api/v2/public/get_shopee_ip_ranges', requireAuth, (req, res) => {
    const ip_list = ['103.48.80.0/22', '143.92.64.0/20', '203.116.172.0/23'];
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      ip_list,
      response: { ip_list },
    });
  });

  app.get('/api/v2/public/get_shops_by_partner', requireAuth, (req, res) => {
    const authed_shop_list = [
      {
        region: DB.shop.region,
        shop_id: DB.shop.shop_id,
        auth_time: DB.shop.auth_time,
        expire_time: DB.shop.expire_time,
        sip_affi_shop_list: [],
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

  app.get('/api/v2/public/get_merchants_by_partner', requireAuth, (req, res) => {
    const authed_merchant_list = [
      {
        region: DB.shop.region,
        merchant_id: 1000001,
        auth_time: DB.shop.auth_time,
        expire_time: DB.shop.expire_time,
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

  app.post('/api/v2/public/get_token_by_resend_code', requireAuth, (req, res) => {
    const payload = {
      access_token: 'MOCK_ACCESS_TOKEN_RESEND_' + Date.now(),
      refresh_token: 'MOCK_REFRESH_TOKEN_RESEND_' + Date.now(),
      expire_in: 14400,
      shop_id_list: [DB.shop.shop_id],
      merchant_id_list: [],
    };
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      ...payload,
      response: payload,
    });
  });

  // ── SHOP ENDPOINTS ──────────────────────────────────────────────────
  app.get('/api/v2/shop/get_profile', requireAuth, (req, res) => {
    const profile = {
      shop_logo: 'https://placehold.co/200x200/EE4D2D/fff?text=Shopee',
      description: DB.shop.description,
      shop_name: DB.shop.shop_name,
    };
    res.json({ error: '', message: '', request_id: rid(), response: profile });
  });

  app.post('/api/v2/shop/update_profile', requireAuth, (req, res) => {
    const { shop_name, description, shop_logo } = req.body || {};
    if (shop_name) DB.shop.shop_name = shop_name;
    if (description !== undefined) DB.shop.description = description;
    saveState();
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        shop_name: DB.shop.shop_name,
        description: DB.shop.description,
        shop_logo: shop_logo || 'https://placehold.co/200x200/EE4D2D/fff?text=Shopee',
      },
    });
  });

  // ── PRODUCT EXTENDED ENDPOINTS ──────────────────────────────────────
  app.get('/api/v2/product/get_category', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { category_list: DB.categories },
    });
  });

  app.get('/api/v2/product/get_attribute_tree', requireAuth, (req, res) => {
    const catIds = parseListParam(req.query.category_id_list).map(Number).filter(Boolean);
    const list = (catIds.length ? catIds : [100002]).map(cid => ({
      category_id: cid,
      attribute_tree: [
        {
          attribute_id: 2001,
          mandatory: false,
          name: 'Material',
          attribute_value_list: [{ value_id: 3001, name: 'Standard', value_unit: '' }],
          attribute_info: { input_type: 1, input_validation_type: 0, format_type: 1 },
        },
      ],
    }));
    res.json({ error: '', message: '', request_id: rid(), response: { list } });
  });

  app.get('/api/v2/product/get_brand_list', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        brand_list: [
          { brand_id: 0, original_brand_name: 'NoBrand', display_brand_name: 'No Brand' },
          { brand_id: 101, original_brand_name: 'Unilab', display_brand_name: 'Unilab' },
        ],
        has_next_page: false,
        next_offset: 0,
        is_mandatory: false,
        input_type: 'DROP_DOWN',
      },
    });
  });

  app.get('/api/v2/product/get_item_limit', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        price_limit: { min_limit: 1, max_limit: 1000000 },
        wholesale_price_threshold_percentage: { min_limit: 0, max_limit: 100 },
        stock_limit: { min_limit: 0, max_limit: 100000 },
        item_name_length_limit: { min_limit: 5, max_limit: 120 },
        item_description_length_limit: { min_limit: 20, max_limit: 3000 },
        item_description_image_limit: { max_limit: 12 },
        item_count_limit: { max_limit: 1000 },
        days_to_ship_limit: { min_limit: 2, max_limit: 30 },
      },
    });
  });

  app.get('/api/v2/product/get_boosted_list', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { item_list: DB.boostedItems },
    });
  });

  app.post('/api/v2/product/boost_item', requireAuth, (req, res) => {
    const itemIds = (req.body && req.body.item_id_list) || [];
    const success_list = [];
    for (const id of itemIds) {
      if (!DB.boostedItems.some(b => b.item_id === id)) {
        DB.boostedItems.push({ item_id: id, cool_down_second: 14400 });
      }
      success_list.push(id);
    }
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { failure_list: [], success_list },
    });
  });

  app.get('/api/v2/product/category_recommend', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { category_id: [100002, 100003] },
    });
  });

  app.get('/api/v2/product/get_recommend_attribute', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        attribute_list: [{ attribute_id: 2001, value_id: 3001 }],
      },
    });
  });

  app.post('/api/v2/product/add_item', requireAuth, (req, res) => {
    const body = req.body || {};
    const newItemId = DB.products.reduce((max, p) => Math.max(max, p.item_id), 10008) + 1;
    const stock =
      (Array.isArray(body.seller_stock) && body.seller_stock[0] && body.seller_stock[0].stock) ??
      body.normal_stock ??
      100;
    const sku = body.item_sku || `SKU-${newItemId}`;
    const name = body.item_name || `Product ${newItemId}`;
    const price = body.original_price || 100;

    const newProduct = {
      item_id: newItemId,
      model_id: 0,
      name,
      sku,
      price,
      category: String(body.category_id || 'General'),
      description: body.description || '',
      weight: body.weight || 0.5,
      item_status: body.item_status || 'NORMAL',
    };
    DB.products.push(newProduct);
    DB.syncedProducts[newItemId] = {
      item_id: newItemId,
      sku,
      name,
      stock,
      source: 'sdk',
      last_sync: nowStr(),
    };
    saveState();

    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        item_id: newItemId,
        item_name: name,
        item_status: newProduct.item_status,
        description: newProduct.description,
        category_id: body.category_id || 100002,
        weight: newProduct.weight,
        price_info: { current_price: price, original_price: price },
        seller_stock: [{ location_id: '', stock }],
        images: {
          image_id_list: (body.image && body.image.image_id_list) || ['mock_img_1'],
          image_url_list: [`https://placehold.co/400x400/EE4D2D/fff?text=${encodeURIComponent(sku)}`],
        },
      },
    });
  });

  app.post('/api/v2/product/update_item', requireAuth, (req, res) => {
    const body = req.body || {};
    const product = DB.products.find(p => p.item_id === Number(body.item_id));
    if (!product) {
      return res.status(400).json({
        error: 'product.error_not_found',
        message: `Item ${body.item_id} not found`,
        request_id: rid(),
      });
    }
    if (body.item_name) product.name = body.item_name;
    if (body.item_sku) product.sku = body.item_sku;
    if (body.description !== undefined) product.description = body.description;
    saveState();
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        item_id: product.item_id,
        item_name: product.name,
        item_status: product.item_status || 'NORMAL',
      },
    });
  });

  app.post('/api/v2/product/update_price', requireAuth, (req, res) => {
    const { item_id, price_list } = req.body || {};
    const product = DB.products.find(p => p.item_id === Number(item_id));
    const newPrice = Array.isArray(price_list) && price_list[0] ? price_list[0].original_price : undefined;
    if (product && newPrice !== undefined) {
      product.price = newPrice;
      saveState();
    }
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        failure_list: [],
        success_list: (price_list || []).map(pl => ({
          model_id: pl.model_id || 0,
          original_price: pl.original_price,
        })),
      },
    });
  });

  app.post('/api/v2/product/delete_item', requireAuth, (req, res) => {
    const { item_id } = req.body || {};
    const idx = DB.products.findIndex(p => p.item_id === Number(item_id));
    if (idx !== -1) {
      DB.products.splice(idx, 1);
      delete DB.syncedProducts[item_id];
      saveState();
    }
    res.json({ error: '', message: '', request_id: rid(), response: {} });
  });

  // ── LOGISTICS EXTENDED ENDPOINTS ────────────────────────────────────
  app.get('/api/v2/logistics/get_channel_list', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        logistics_channel_list: [
          {
            logistics_channel_id: 20001,
            logistics_channel_name: 'SPX Express',
            cod_enabled: true,
            enabled: true,
            fee_type: 'SIZE_INPUT',
            size_list: [],
            weight_limit: { item_max_weight: 30, item_min_weight: 0.01 },
            item_max_dimension: { height: 100, width: 100, length: 100, unit: 'cm', dimension_sum: 300 },
            volume_limit: { item_max_volume: 100000, item_min_volume: 1 },
            logistics_description: 'Standard Local Delivery via SPX Express',
            force_enable: false,
            mask_channel_id: 0,
            block_seller_cover_shipping_fee: false,
          },
          {
            logistics_channel_id: 20002,
            logistics_channel_name: 'J&T Express',
            cod_enabled: true,
            enabled: true,
            fee_type: 'SIZE_INPUT',
            size_list: [],
            weight_limit: { item_max_weight: 50, item_min_weight: 0.01 },
            item_max_dimension: { height: 120, width: 120, length: 120, unit: 'cm', dimension_sum: 360 },
            volume_limit: { item_max_volume: 150000, item_min_volume: 1 },
            logistics_description: 'J&T Express Local Delivery',
            force_enable: false,
            mask_channel_id: 0,
            block_seller_cover_shipping_fee: false,
          },
        ],
      },
    });
  });

  app.post('/api/v2/logistics/get_shipping_document_parameter', requireAuth, (req, res) => {
    const orderList = (req.body && req.body.order_list) || [];
    const missing = orderList.find(o => !DB.orders.some(ord => ord.order_sn === o.order_sn));
    if (missing) {
      return res.status(400).json({
        error: 'order.order_not_exists',
        message: `Order ${missing.order_sn} does not exist.`,
        request_id: rid(),
      });
    }
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        result_list: orderList.map(o => ({
          order_sn: o.order_sn,
          package_number: o.package_number || '',
          suggest_shipping_document_type: 'THERMAL_AIR_WAYBILL',
          selectable_shipping_document_type: ['THERMAL_AIR_WAYBILL', 'NORMAL_AIR_WAYBILL'],
          fail_error: '',
          fail_message: '',
        })),
      },
    });
  });

  app.post('/api/v2/logistics/download_shipping_document_job', requireAuth, (req, res) => {
    const { job_id } = req.body || {};
    if (!job_id || String(job_id).includes('DUMMY') || String(job_id).includes('NONEXISTENT')) {
      return res.status(400).json({
        error: 'logistics.error_param',
        message: `Invalid or unknown job_id: ${job_id}`,
        request_id: rid(),
      });
    }
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { job_id },
    });
  });

  // ── PAYMENT ENDPOINTS ───────────────────────────────────────────────
  app.get('/api/v2/payment/get_payment_method_list', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: [
        {
          region: 'PH',
          payment_method: ['Cash on Delivery', 'ShopeePay', 'Credit/Debit Card', 'GCash'],
        },
        {
          region: 'VN',
          payment_method: ['Cash on Delivery', 'ShopeePay', 'VNPay', 'Credit/Debit Card'],
        },
      ],
    });
  });

  app.get('/api/v2/payment/get_shop_installment_status', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { installment_status: 1 },
    });
  });

  app.get('/api/v2/payment/get_escrow_detail', requireAuth, (req, res) => {
    const { order_sn } = req.query;
    const order = DB.orders.find(o => o.order_sn === order_sn);
    if (!order) {
      return res.status(400).json({
        error: 'error_not_found',
        message: `Order ${order_sn} not found`,
        request_id: rid(),
      });
    }
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        order_sn: order.order_sn,
        buyer_user_name: order.buyer_username,
        return_order_sn_list: [],
        order_income: {
          escrow_amount: order.total_amount,
          buyer_total_amount: order.total_amount,
          original_price: order.total_amount,
          seller_discount: 0,
          shopee_discount: 0,
          voucher_from_seller: 0,
          voucher_from_shopee: 0,
          coins: 0,
          buyer_paid_shipping_fee: 0,
          buyer_transaction_fee: 0,
          cross_border_tax: 0,
          payment_promotion: 0,
          commission_fee: 0,
          service_fee: 0,
          seller_transaction_fee: 0,
          seller_lost_compensation: 0,
          seller_coin_cash_back: 0,
          escrow_tax: 0,
          final_shipping_fee: 0,
          actual_shipping_fee: 0,
          order_chargeable_weight: 500,
          items: order.item_list.map(i => ({
            item_id: i.item_id,
            item_name: i.item_name,
            item_sku: i.item_sku,
            model_id: i.model_id,
            model_name: '',
            model_sku: i.model_sku,
            original_price: i.model_original_price,
            discounted_price: i.model_discounted_price,
            quantity_purchased: i.model_quantity_purchased,
          })),
        },
      },
    });
  });

  // ── RETURNS ENDPOINTS ───────────────────────────────────────────────
  app.get('/api/v2/returns/get_return_list', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        more: false,
        return: DB.returns,
      },
    });
  });

  app.get('/api/v2/returns/get_return_detail', requireAuth, (req, res) => {
    const { return_sn } = req.query;
    const ret = DB.returns.find(r => String(r.return_sn) === String(return_sn));
    if (!ret) {
      return res.status(400).json({
        error: 'returns.return_not_exist',
        message: `Return ${return_sn} does not exist.`,
        request_id: rid(),
      });
    }
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: ret,
    });
  });

  // ── VOUCHER ENDPOINTS (STATEFUL CRUD) ───────────────────────────────
  app.post('/api/v2/voucher/add_voucher', requireAuth, (req, res) => {
    const body = req.body || {};
    const voucher_id = Date.now() + Math.floor(Math.random() * 1000);
    const voucher = {
      voucher_id,
      voucher_code: body.voucher_code || 'MOCKVOUCHER',
      voucher_name: body.voucher_name || 'Mock Voucher',
      voucher_type: body.voucher_type ?? 1,
      reward_type: body.reward_type ?? 1,
      usage_quantity: body.usage_quantity ?? 100,
      current_usage: 0,
      start_time: body.start_time || ts() + 3600,
      end_time: body.end_time || ts() + 86400,
      is_admin: false,
      voucher_purpose: 0,
      discount_amount: body.discount_amount || 0,
      percentage: body.percentage || 0,
      min_basket_price: body.min_basket_price || 0,
    };
    DB.vouchers.push(voucher);
    res.json({ error: '', message: '', request_id: rid(), response: { voucher_id } });
  });

  app.get('/api/v2/voucher/get_voucher', requireAuth, (req, res) => {
    const voucher_id = Number(req.query.voucher_id);
    const voucher = DB.vouchers.find(v => v.voucher_id === voucher_id) || {
      voucher_id,
      voucher_code: 'MOCKVOUCHER',
      voucher_name: 'Integration Test Voucher',
      voucher_type: 1,
      reward_type: 1,
      usage_quantity: 10,
      current_usage: 0,
      start_time: ts() + 3600,
      end_time: ts() + 86400,
    };
    res.json({ error: '', message: '', request_id: rid(), response: voucher });
  });

  app.post('/api/v2/voucher/update_voucher', requireAuth, (req, res) => {
    const body = req.body || {};
    const voucher_id = Number(body.voucher_id);
    const voucher = DB.vouchers.find(v => v.voucher_id === voucher_id);
    if (voucher) Object.assign(voucher, body);
    res.json({ error: '', message: '', request_id: rid(), response: { voucher_id } });
  });

  app.post('/api/v2/voucher/delete_voucher', requireAuth, (req, res) => {
    const voucher_id = Number(req.body && req.body.voucher_id);
    DB.vouchers = DB.vouchers.filter(v => v.voucher_id !== voucher_id);
    res.json({ error: '', message: '', request_id: rid(), response: { voucher_id } });
  });

  app.post('/api/v2/voucher/end_voucher', requireAuth, (req, res) => {
    const voucher_id = Number(req.body && req.body.voucher_id);
    res.json({ error: '', message: '', request_id: rid(), response: { voucher_id } });
  });

  app.get('/api/v2/voucher/get_voucher_list', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { more: false, voucher_list: DB.vouchers },
    });
  });

  // ── SHOP CATEGORY ENDPOINTS (STATEFUL CRUD) ─────────────────────────
  app.post('/api/v2/shop_category/add_shop_category', requireAuth, (req, res) => {
    const body = req.body || {};
    const shop_category_id = Date.now() + Math.floor(Math.random() * 1000);
    const cat = {
      shop_category_id,
      name: body.name || 'Mock Category',
      sort_weight: body.sort_weight ?? 1,
      status: 'NORMAL',
    };
    DB.shopCategories.push(cat);
    res.json({ error: '', message: '', request_id: rid(), response: { shop_category_id } });
  });

  app.get('/api/v2/shop_category/get_shop_category_list', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        shop_categorys: DB.shopCategories,
        total_count: DB.shopCategories.length,
        more: false,
      },
    });
  });

  app.post('/api/v2/shop_category/update_shop_category', requireAuth, (req, res) => {
    const body = req.body || {};
    const id = Number(body.shop_category_id);
    const cat = DB.shopCategories.find(c => c.shop_category_id === id);
    if (cat) Object.assign(cat, body);
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { shop_category_id: id, name: cat ? cat.name : body.name, status: 'NORMAL' },
    });
  });

  app.post('/api/v2/shop_category/delete_shop_category', requireAuth, (req, res) => {
    const id = Number(req.body && req.body.shop_category_id);
    DB.shopCategories = DB.shopCategories.filter(c => c.shop_category_id !== id);
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { shop_category_id: id, msg: 'success' },
    });
  });

  // ── DISCOUNT ENDPOINTS (STATEFUL CRUD) ──────────────────────────────
  app.post('/api/v2/discount/add_discount', requireAuth, (req, res) => {
    const body = req.body || {};
    const discount_id = Date.now() + Math.floor(Math.random() * 1000);
    const disc = {
      discount_id,
      discount_name: body.discount_name || 'Mock Discount',
      start_time: body.start_time || ts() + 3600,
      end_time: body.end_time || ts() + 86400,
      status: 'upcoming',
    };
    DB.discounts.push(disc);
    res.json({ error: '', message: '', request_id: rid(), response: { discount_id } });
  });

  app.get('/api/v2/discount/get_discount', requireAuth, (req, res) => {
    const discount_id = Number(req.query.discount_id);
    const disc = DB.discounts.find(d => d.discount_id === discount_id) || {
      discount_id,
      discount_name: 'Mock Discount',
      start_time: ts() + 3600,
      end_time: ts() + 86400,
      status: 'upcoming',
      item_list: [],
      more: false,
    };
    res.json({ error: '', message: '', request_id: rid(), response: disc });
  });

  app.post('/api/v2/discount/update_discount', requireAuth, (req, res) => {
    const body = req.body || {};
    const discount_id = Number(body.discount_id);
    const disc = DB.discounts.find(d => d.discount_id === discount_id);
    if (disc) Object.assign(disc, body);
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { discount_id, modify_time: ts() },
    });
  });

  app.post('/api/v2/discount/delete_discount', requireAuth, (req, res) => {
    const discount_id = Number(req.body && req.body.discount_id);
    DB.discounts = DB.discounts.filter(d => d.discount_id !== discount_id);
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { discount_id, modify_time: ts() },
    });
  });

  app.get('/api/v2/discount/get_discount_list', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { discount_list: DB.discounts, more: false },
    });
  });

  // ── BUNDLE DEAL ENDPOINTS (STATEFUL CRUD) ───────────────────────────
  app.post('/api/v2/bundle_deal/add_bundle_deal', requireAuth, (req, res) => {
    const body = req.body || {};
    const bundle_deal_id = Date.now() + Math.floor(Math.random() * 1000);
    const deal = {
      bundle_deal_id,
      name: body.name || 'Mock Bundle Deal',
      start_time: body.start_time || ts() + 3600,
      end_time: body.end_time || ts() + 86400,
      time_status: 2,
      bundle_deal_rule: {
        rule_type: body.rule_type ?? 1,
        discount_value: body.discount_value ?? 0,
        fix_price: body.fix_price ?? 0,
        discount_percentage: body.discount_percentage ?? 10,
        min_amount: body.min_amount ?? 2,
      },
      purchase_limit: body.purchase_limit ?? 5,
    };
    DB.bundleDeals.push(deal);
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { bundle_deal_id },
    });
  });

  app.get('/api/v2/bundle_deal/get_bundle_deal', requireAuth, (req, res) => {
    const bundle_deal_id = Number(req.query.bundle_deal_id || (req.body && req.body.bundle_deal_id));
    const deal = DB.bundleDeals.find(b => b.bundle_deal_id === bundle_deal_id) || {
      bundle_deal_id,
      name: 'Mock Bundle Deal',
      start_time: ts() + 3600,
      end_time: ts() + 86400,
    };
    res.json({ error: '', message: '', request_id: rid(), response: deal });
  });

  app.post('/api/v2/bundle_deal/update_bundle_deal', requireAuth, (req, res) => {
    const body = req.body || {};
    const bundle_deal_id = Number(body.bundle_deal_id);
    const deal = DB.bundleDeals.find(b => b.bundle_deal_id === bundle_deal_id);
    if (deal) Object.assign(deal, body);
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: deal || { bundle_deal_id, name: body.name },
    });
  });

  app.post('/api/v2/bundle_deal/delete_bundle_deal', requireAuth, (req, res) => {
    const bundle_deal_id = Number(req.body && req.body.bundle_deal_id);
    DB.bundleDeals = DB.bundleDeals.filter(b => b.bundle_deal_id !== bundle_deal_id);
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { bundle_deal_id },
    });
  });

  app.get('/api/v2/bundle_deal/get_bundle_deal_list', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { bundle_deal_list: DB.bundleDeals, more: false },
    });
  });

  // ── FOLLOW PRIZE ENDPOINTS (STATEFUL CRUD) ──────────────────────────
  app.post('/api/v2/follow_prize/add_follow_prize', requireAuth, (req, res) => {
    const body = req.body || {};
    const campaign_id = Date.now() + Math.floor(Math.random() * 1000);
    const prize = {
      campaign_id,
      campagin_id: campaign_id,
      follow_prize_name: body.follow_prize_name || 'Mock Follow Prize',
      campaign_status: 'upcoming',
      start_time: body.start_time || ts() + 3600,
      end_time: body.end_time || ts() + 86400,
      usage_quantity: body.usage_quantity ?? 100,
      min_spend: body.min_spend ?? 0,
      reward_type: body.reward_type ?? 1,
      discount_amount: body.discount_amount ?? 0,
      percentage: body.percentage ?? 0,
    };
    DB.followPrizes.push(prize);
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { campaign_id, campagin_id: campaign_id },
    });
  });

  app.get('/api/v2/follow_prize/get_follow_prize_detail', requireAuth, (req, res) => {
    const campaign_id = Number(req.query.campaign_id);
    const prize = DB.followPrizes.find(p => p.campaign_id === campaign_id) || {
      campaign_id,
      follow_prize_name: 'Mock Follow Prize',
      campaign_status: 'upcoming',
    };
    res.json({ error: '', message: '', request_id: rid(), response: prize });
  });

  app.post('/api/v2/follow_prize/update_follow_prize', requireAuth, (req, res) => {
    const body = req.body || {};
    const campaign_id = Number(body.campaign_id);
    const prize = DB.followPrizes.find(p => p.campaign_id === campaign_id);
    if (prize) Object.assign(prize, body);
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { campaign_id, campagin_id: campaign_id },
    });
  });

  app.post('/api/v2/follow_prize/delete_follow_prize', requireAuth, (req, res) => {
    const campaign_id = Number(req.body && req.body.campaign_id);
    DB.followPrizes = DB.followPrizes.filter(p => p.campaign_id !== campaign_id);
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { campaign_id, campagin_id: campaign_id },
    });
  });

  app.post('/api/v2/follow_prize/end_follow_prize', requireAuth, (req, res) => {
    const campaign_id = Number(req.body && req.body.campaign_id);
    const prize = DB.followPrizes.find(p => p.campaign_id === campaign_id);
    if (prize) prize.campaign_status = 'expired';
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { campaign_id, campagin_id: campaign_id },
    });
  });

  app.get('/api/v2/follow_prize/get_follow_prize_list', requireAuth, (req, res) => {
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { follow_prize_list: DB.followPrizes, more: false },
    });
  });

  // ── MEDIA SPACE & MEDIA ENDPOINTS ───────────────────────────────────
  app.post('/api/v2/media_space/upload_image', requireAuth, (req, res) => {
    const imgId = 'sg-11134201-' + Date.now().toString(36);
    const imgUrl = `https://cf.shopee.ph/file/${imgId}`;
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        image_info: {
          image_id: imgId,
          image_url_list: [{ image_url_region: 'PH', image_url: imgUrl }],
        },
        image_info_list: [
          {
            id: 0,
            error: '',
            message: '',
            image_info: {
              image_id: imgId,
              image_url_list: [{ image_url_region: 'PH', image_url: imgUrl }],
            },
          },
        ],
      },
    });
  });

  app.post('/api/v2/media/upload_image', requireAuth, (req, res) => {
    const imgId = 'sg-11134202-' + Date.now().toString(36);
    const imgUrl = `https://cf.shopee.ph/file/${imgId}`;
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        image_list: [{ image_id: imgId, image_url: imgUrl }],
      },
    });
  });

  app.post('/api/v2/media_space/init_video_upload', requireAuth, (req, res) => {
    const video_upload_id = 'vid_' + Date.now().toString(36);
    DB.videoUploads[video_upload_id] = { status: 'INITIATED', parts: [] };
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: { video_upload_id },
    });
  });

  app.post('/api/v2/media_space/upload_video_part', requireAuth, (req, res) => {
    res.json({ error: '', message: '', request_id: rid(), response: {} });
  });

  app.post('/api/v2/media_space/complete_video_upload', requireAuth, (req, res) => {
    const { video_upload_id } = req.body || {};
    if (video_upload_id && DB.videoUploads[video_upload_id]) {
      DB.videoUploads[video_upload_id].status = 'SUCCEEDED';
    }
    res.json({ error: '', message: '', request_id: rid(), response: {} });
  });

  app.get('/api/v2/media_space/get_video_upload_result', requireAuth, (req, res) => {
    const { video_upload_id } = req.query;
    const upload = DB.videoUploads[video_upload_id] || { status: 'SUCCEEDED' };
    res.json({
      error: '',
      message: '',
      request_id: rid(),
      response: {
        status: upload.status,
        video_info: {
          video_url_list: [{ video_url_region: 'PH', video_url: `https://cv.shopee.ph/file/${video_upload_id}.mp4` }],
          thumbnail_url_list: [{ image_url_region: 'PH', image_url: `https://cf.shopee.ph/file/${video_upload_id}_thumb.jpg` }],
          duration: 10,
        },
      },
    });
  });

  app.post('/api/v2/media_space/cancel_video_upload', requireAuth, (req, res) => {
    const { video_upload_id } = req.body || {};
    if (video_upload_id) delete DB.videoUploads[video_upload_id];
    res.json({ error: '', message: '', request_id: rid(), response: {} });
  });

  // ── UNIVERSAL 455-SCHEMA FALLBACK FOR ANY OTHER /api/v2/* ROUTE ─────
  app.all('/api/v2/*', requireAuth, (req, res, next) => {
    const spec = schemaMap.get(req.path);
    if (!spec) {
      return next();
    }
    console.log(`[SCHEMA-FALLBACK] ${req.method} ${req.path} (${spec.api_name})`);
    const cloned = JSON.parse(JSON.stringify(spec.samplePayload));
    cloned.request_id = rid();
    cloned.error = '';
    cloned.message = '';
    return res.json(cloned);
  });
}

module.exports = {
  registerSdkRoutes,
  parseListParam,
};
