import { Request, Response, Router } from 'express';
import { rid, ts } from '../config/env';
import { requireAuth } from '../middleware/signature';
import { DB } from '../store/database';

export const voucherRouter = Router();
export const discountRouter = Router();
export const bundleDealRouter = Router();
export const followPrizeRouter = Router();
export const shopCategoryRouter = Router();

// ── VOUCHERS ──────────────────────────────────────────────────────────
voucherRouter.post('/add_voucher', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  const voucher_id = Date.now() + Math.floor(Math.random() * 1000);
  DB.vouchers.push({
    voucher_id,
    voucher_code: body.voucher_code || `VCH${voucher_id}`,
    voucher_name: body.voucher_name || `Voucher ${voucher_id}`,
    voucher_type: body.voucher_type || 1,
    reward_type: body.reward_type || 1,
    usage_quantity: body.usage_quantity || 100,
    current_usage: 0,
    start_time: body.start_time || ts() + 60,
    end_time: body.end_time || ts() + 86400,
    is_admin: false,
    voucher_purpose: 0,
    min_basket_price: body.min_basket_price || 100,
    discount_amount: body.discount_amount || 10,
    percentage: body.percentage,
    max_price: body.max_price,
    status: 'upcoming',
  });
  res.json({ error: '', message: '', request_id: rid(), response: { voucher_id } });
});

voucherRouter.get('/get_voucher', requireAuth, (req: Request, res: Response) => {
  const voucherId = Number(req.query.voucher_id);
  const v = DB.vouchers.find((x) => x.voucher_id === voucherId) || {
    voucher_id: voucherId,
    voucher_code: 'MOCKVCH',
    voucher_name: 'Mock Voucher',
    voucher_type: 1,
    reward_type: 1,
    usage_quantity: 100,
    current_usage: 0,
    start_time: ts(),
    end_time: ts() + 86400,
    is_admin: false,
    voucher_purpose: 0,
    min_basket_price: 100,
    discount_amount: 10,
  };
  res.json({ error: '', message: '', request_id: rid(), response: v });
});

voucherRouter.get('/get_voucher_list', requireAuth, (req: Request, res: Response) => {
  const status = String(req.query.status || 'all');
  const list =
    status === 'all' ? DB.vouchers : DB.vouchers.filter((v) => v.status === status || status === 'upcoming');
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { more: false, voucher_list: list },
  });
});

voucherRouter.post('/update_voucher', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  const voucherId = Number(body.voucher_id);
  const v = DB.vouchers.find((x) => x.voucher_id === voucherId);
  if (v) Object.assign(v, body);
  res.json({ error: '', message: '', request_id: rid(), response: { voucher_id: voucherId } });
});

voucherRouter.post('/end_voucher', requireAuth, (req: Request, res: Response) => {
  const voucherId = Number(req.body?.voucher_id);
  const v = DB.vouchers.find((x) => x.voucher_id === voucherId);
  if (v) v.status = 'expired';
  res.json({ error: '', message: '', request_id: rid(), response: { voucher_id: voucherId } });
});

voucherRouter.post('/delete_voucher', requireAuth, (req: Request, res: Response) => {
  const voucherId = Number(req.body?.voucher_id);
  DB.vouchers = DB.vouchers.filter((x) => x.voucher_id !== voucherId);
  res.json({ error: '', message: '', request_id: rid(), response: { voucher_id: voucherId } });
});

// ── DISCOUNTS ─────────────────────────────────────────────────────────
discountRouter.post('/add_discount', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  const discount_id = Date.now() + Math.floor(Math.random() * 1000);
  DB.discounts.push({
    discount_id,
    discount_name: body.discount_name || `Discount ${discount_id}`,
    start_time: body.start_time || ts() + 60,
    end_time: body.end_time || ts() + 86400,
    status: 'upcoming',
    item_list: [],
  });
  res.json({ error: '', message: '', request_id: rid(), response: { discount_id } });
});

discountRouter.get('/get_discount', requireAuth, (req: Request, res: Response) => {
  const discountId = Number(req.query.discount_id);
  const d = DB.discounts.find((x) => x.discount_id === discountId) || {
    discount_id: discountId,
    discount_name: 'Mock Discount',
    start_time: ts(),
    end_time: ts() + 86400,
    status: 'upcoming',
    item_list: [],
  };
  res.json({ error: '', message: '', request_id: rid(), response: { ...d, more: false } });
});

discountRouter.get('/get_discount_list', requireAuth, (req: Request, res: Response) => {
  const status = String(req.query.discount_status || 'all');
  const list =
    status === 'all' ? DB.discounts : DB.discounts.filter((d) => d.status === status || status === 'upcoming');
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { discount_list: list, more: false },
  });
});

discountRouter.post('/update_discount', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  const discountId = Number(body.discount_id);
  const d = DB.discounts.find((x) => x.discount_id === discountId);
  if (d) Object.assign(d, body);
  res.json({ error: '', message: '', request_id: rid(), response: { discount_id: discountId } });
});

discountRouter.post('/delete_discount', requireAuth, (req: Request, res: Response) => {
  const discountId = Number(req.body?.discount_id);
  DB.discounts = DB.discounts.filter((x) => x.discount_id !== discountId);
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { discount_id: discountId, modify_time: ts() },
  });
});

// ── BUNDLE DEALS ──────────────────────────────────────────────────────
bundleDealRouter.post('/add_bundle_deal', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  const bundle_deal_id = Date.now() + Math.floor(Math.random() * 1000);
  DB.bundleDeals.push({
    bundle_deal_id,
    name: body.name || `Bundle ${bundle_deal_id}`,
    start_time: body.start_time || ts() + 60,
    end_time: body.end_time || ts() + 86400,
    time_status: 2,
    bundle_deal_rule: body.bundle_deal_rule || { rule_type: 1, discount_value: 10, min_amount: 2 },
    purchase_limit: body.purchase_limit || 5,
  });
  res.json({ error: '', message: '', request_id: rid(), response: { bundle_deal_id } });
});

bundleDealRouter.get('/get_bundle_deal', requireAuth, (req: Request, res: Response) => {
  const bundleDealId = Number(req.query.bundle_deal_id);
  const b = DB.bundleDeals.find((x) => x.bundle_deal_id === bundleDealId) || {
    bundle_deal_id: bundleDealId,
    name: 'Mock Bundle Deal',
    start_time: ts(),
    end_time: ts() + 86400,
    time_status: 2,
    bundle_deal_rule: { rule_type: 1, discount_value: 10, min_amount: 2 },
    purchase_limit: 5,
  };
  res.json({ error: '', message: '', request_id: rid(), response: b });
});

bundleDealRouter.get('/get_bundle_deal_list', requireAuth, (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { bundle_deal_list: DB.bundleDeals, more: false },
  });
});

bundleDealRouter.post('/update_bundle_deal', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  const bundleDealId = Number(body.bundle_deal_id);
  const b = DB.bundleDeals.find((x) => x.bundle_deal_id === bundleDealId);
  if (b) Object.assign(b, body);
  res.json({ error: '', message: '', request_id: rid(), response: b || { bundle_deal_id: bundleDealId } });
});

bundleDealRouter.post('/delete_bundle_deal', requireAuth, (req: Request, res: Response) => {
  const bundleDealId = Number(req.body?.bundle_deal_id);
  DB.bundleDeals = DB.bundleDeals.filter((x) => x.bundle_deal_id !== bundleDealId);
  res.json({ error: '', message: '', request_id: rid(), response: { bundle_deal_id: bundleDealId } });
});

// ── FOLLOW PRIZES ─────────────────────────────────────────────────────
followPrizeRouter.post('/add_follow_prize', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  const campaign_id = Date.now() + Math.floor(Math.random() * 1000);
  DB.followPrizes.push({
    campaign_id,
    campaign_status: 'upcoming',
    follow_prize_name: body.follow_prize_name || `Prize ${campaign_id}`,
    start_time: body.start_time || ts() + 60,
    end_time: body.end_time || ts() + 86400,
    usage_quantity: body.usage_quantity || 100,
    min_spend: body.min_spend || 100,
    reward_type: body.reward_type || 1,
    discount_amount: body.discount_amount || 10,
    percentage: body.percentage,
    max_price: body.max_price,
  });
  res.json({ error: '', message: '', request_id: rid(), response: { campaign_id } });
});

followPrizeRouter.get('/get_follow_prize_detail', requireAuth, (req: Request, res: Response) => {
  const campaignId = Number(req.query.campaign_id);
  const fp = DB.followPrizes.find((x) => x.campaign_id === campaignId) || {
    campaign_id: campaignId,
    campaign_status: 'upcoming',
    follow_prize_name: 'Mock Follow Prize',
    start_time: ts(),
    end_time: ts() + 86400,
    usage_quantity: 100,
    min_spend: 100,
    reward_type: 1,
    discount_amount: 10,
  };
  res.json({ error: '', message: '', request_id: rid(), response: fp });
});

followPrizeRouter.get('/get_follow_prize_list', requireAuth, (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { follow_prize_list: DB.followPrizes, more: false },
  });
});

followPrizeRouter.post('/update_follow_prize', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  const campaignId = Number(body.campaign_id);
  const fp = DB.followPrizes.find((x) => x.campaign_id === campaignId);
  if (fp) Object.assign(fp, body);
  res.json({ error: '', message: '', request_id: rid(), response: { campaign_id: campaignId } });
});

followPrizeRouter.post('/end_follow_prize', requireAuth, (req: Request, res: Response) => {
  const campaignId = Number(req.body?.campaign_id);
  const fp = DB.followPrizes.find((x) => x.campaign_id === campaignId);
  if (fp) fp.campaign_status = 'expired';
  res.json({ error: '', message: '', request_id: rid(), response: { campaign_id: campaignId } });
});

followPrizeRouter.post('/delete_follow_prize', requireAuth, (req: Request, res: Response) => {
  const campaignId = Number(req.body?.campaign_id);
  DB.followPrizes = DB.followPrizes.filter((x) => x.campaign_id !== campaignId);
  res.json({ error: '', message: '', request_id: rid(), response: { campaign_id: campaignId } });
});

// ── SHOP CATEGORIES ───────────────────────────────────────────────────
shopCategoryRouter.post('/add_shop_category', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  const shop_category_id = Date.now() + Math.floor(Math.random() * 1000);
  DB.shopCategories.push({
    shop_category_id,
    name: body.name || `Category ${shop_category_id}`,
    status: 1,
    sort_weight: body.sort_weight || 1,
  });
  res.json({ error: '', message: '', request_id: rid(), response: { shop_category_id } });
});

shopCategoryRouter.get('/get_shop_category_list', requireAuth, (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      shop_categorys: DB.shopCategories,
      more: false,
      total_count: DB.shopCategories.length,
    },
  });
});

shopCategoryRouter.post('/update_shop_category', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  const catId = Number(body.shop_category_id);
  const sc = DB.shopCategories.find((x) => x.shop_category_id === catId);
  if (sc) Object.assign(sc, body);
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: sc || { shop_category_id: catId, name: body.name, status: body.status || 1 },
  });
});

shopCategoryRouter.post('/delete_shop_category', requireAuth, (req: Request, res: Response) => {
  const catId = Number(req.body?.shop_category_id);
  DB.shopCategories = DB.shopCategories.filter((x) => x.shop_category_id !== catId);
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { shop_category_id: catId, msg: 'success' },
  });
});
