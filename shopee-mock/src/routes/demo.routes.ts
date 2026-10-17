import path from 'path';
import { Request, Response, Router } from 'express';
import { CONFIG, nowStr, rid, ts } from '../config/env';
import { notifyOdooDelivered } from '../services/odoo-webhook.service';
import { buildShippingLabelPDF } from '../services/pdf-label.service';
import { DB, nextOrderCounter, resetState, saveState } from '../store/database';
import { DELIVERY_STEPS } from '../store/seed';
import { Order } from '../store/types';

export const demoRouter = Router();

// Serve Seller Centre Web UI
demoRouter.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(CONFIG.publicDir, 'seller-centre.html'));
});

// Live state JSON for Seller Centre UI
demoRouter.get('/api/demo/state', (_req: Request, res: Response) => {
  res.json({
    shop: DB.shop,
    products: DB.products,
    syncedProducts: DB.syncedProducts,
    orders: DB.orders,
    trackingNumbers: DB.trackingNumbers,
    labelStatus: DB.labelStatus,
    deliveryStatus: DB.deliveryStatus,
    deliverySteps: DELIVERY_STEPS,
  });
});

demoRouter.post('/api/demo/create_order', (req: Request, res: Response) => {
  const { name, phone, city, carrier, item_id, sku, item_name, qty, price } = req.body || {};
  const counter = nextOrderCounter();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const sn = `SPX${today}${String(counter).padStart(3, '0')}`;
  const now = ts();
  const order: Order = {
    order_sn: sn,
    order_status: 'READY_TO_SHIP',
    fulfillment_flag: 'fulfilled_by_local_seller',
    create_time: now,
    update_time: now,
    buyer_user_id: 1000 + counter,
    buyer_username: String(name || 'buyer')
      .toLowerCase()
      .replace(/\s+/g, '_'),
    shipping_carrier: carrier || 'SPX Express',
    currency: 'PHP',
    total_amount: (Number(qty) || 1) * (Number(price) || 100),
    estimated_shipping_fee: 0,
    actual_shipping_fee: 0,
    actual_shipping_fee_confirmed: false,
    tracking_no: '',
    package_list: [
      {
        package_number: '',
        logistics_status: 'LOGISTICS_REQUEST_CREATED',
        shipping_carrier: carrier || 'SPX Express',
        item_list: [],
      },
    ],
    recipient_address: {
      name: name || 'Customer',
      phone: phone || '+639000000000',
      full_address: `${Math.floor(Math.random() * 999) + 1} Demo Street, ${city || 'Manila'}, Metro Manila, 1000, PH`,
      city: city || 'Manila',
      state: 'Metro Manila',
      region: 'PH',
      zipcode: '1000',
    },
    item_list: [
      {
        item_id: Number(item_id) || 10001,
        model_id: 0,
        item_name: item_name || 'Demo Item',
        item_sku: sku || 'SKU-DEMO',
        model_sku: sku || 'SKU-DEMO',
        model_quantity_purchased: Number(qty) || 1,
        model_original_price: Number(price) || 100,
        model_discounted_price: Number(price) || 100,
      },
    ],
  };
  DB.orders.push(order);
  saveState();
  res.json({ order_sn: sn, message: 'Order created successfully' });
});

demoRouter.post('/api/demo/ship_order', (req: Request, res: Response) => {
  const { order_sn } = req.body || {};
  const order = DB.orders.find((o) => o.order_sn === order_sn);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const tracking = 'PHSPX' + Date.now();
  order.order_status = 'PROCESSED';
  order.tracking_no = tracking;
  order.update_time = ts();
  DB.trackingNumbers[order_sn] = tracking;
  DB.labelStatus[order_sn] = 'PROCESSING';
  DB.deliveryStatus[order_sn] = 1;
  saveState();
  res.json({ order_sn, tracking_number: tracking, message: 'Order shipped successfully' });
});

demoRouter.post('/api/demo/advance_delivery', async (req: Request, res: Response) => {
  const { order_sn } = req.body || {};
  const order = DB.orders.find((o) => o.order_sn === order_sn);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  if (!['SHIPPED', 'PROCESSED'].includes(order.order_status)) {
    res.status(400).json({ error: 'Order must be SHIPPED or PROCESSED to advance delivery.' });
    return;
  }
  if (order.order_status === 'PROCESSED') {
    order.order_status = 'SHIPPED';
  }
  const current = DB.deliveryStatus[order_sn] ?? 1;
  if (current >= 4) {
    res.json({ order_sn, step: 4, step_name: 'Delivered', message: 'Already delivered.' });
    return;
  }
  const next = current + 1;
  DB.deliveryStatus[order_sn] = next;
  order.update_time = ts();
  if (next === 4) {
    order.item_list.forEach((item) => {
      const sp = DB.syncedProducts[item.item_id];
      if (sp) {
        sp.stock = Math.max(0, sp.stock - item.model_quantity_purchased);
        sp.last_sync = nowStr();
      }
    });
    notifyOdooDelivered(order_sn).catch(() => {});
  }
  saveState();
  res.json({
    order_sn,
    step: next,
    step_name: DELIVERY_STEPS[next],
    message: next === 4 ? 'Delivered. Odoo webhook attempted.' : `Advanced to: ${DELIVERY_STEPS[next]}`,
  });
});

demoRouter.post('/api/demo/reset', (_req: Request, res: Response) => {
  resetState();
  res.json({ message: 'State reset to defaults' });
});

demoRouter.get('/api/demo/print_label/:order_sn', async (req: Request, res: Response) => {
  const orderSn = String(req.params.order_sn || '');
  const order = DB.orders.find((o) => o.order_sn === orderSn);
  if (!order) {
    res.status(404).send('Order not found');
    return;
  }
  const tracking = DB.trackingNumbers[orderSn] || order.tracking_no || 'PHSPX' + Date.now();
  DB.trackingNumbers[orderSn] = tracking;
  DB.labelStatus[orderSn] = 'STORED';
  saveState();

  const pdfBuffer = await buildShippingLabelPDF(order, tracking);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Length', String(pdfBuffer.length));
  res.send(pdfBuffer);
});

demoRouter.get('/track/:tracking', (req: Request, res: Response) => {
  const tracking = String(req.params.tracking || '').trim().toUpperCase();
  const order = DB.orders.find(
    (o) =>
      (o.tracking_no || '').toUpperCase() === tracking ||
      (DB.trackingNumbers[o.order_sn] || '').toUpperCase() === tracking
  );
  const currentStep = order
    ? DB.deliveryStatus[order.order_sn] ?? (order.order_status === 'SHIPPED' ? 1 : 0)
    : 1;

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Track — ${tracking}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:white;border-radius:16px;max-width:460px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden}
.header{background:#EE4D2D;padding:20px 24px;color:white}.body{padding:24px}
.row{display:flex;justify-content:space-between;margin-bottom:10px;font-size:13px}.step{padding:8px 0;font-size:13px;font-weight:600}</style></head><body>
<div class="card"><div class="header"><h2>SPX Express Tracking</h2><div style="font-size:20px;font-weight:700;margin-top:6px">${tracking}</div></div>
<div class="body">${
    order
      ? `<div class="row"><span>Order</span><strong>${order.order_sn}</strong></div>
         <div class="row"><span>Recipient</span><strong>${order.recipient_address.name}</strong></div>
         <hr style="margin:14px 0;border:none;border-top:1px solid #eee">
         ${DELIVERY_STEPS.map(
           (s, i) =>
             `<div class="step" style="color:${i <= currentStep ? '#EE4D2D' : '#bbb'}">${i <= currentStep ? '✓' : '○'} ${s}</div>`
         ).join('')}`
      : `<p>Tracking number not found: <strong>${tracking}</strong></p>`
  }</div></div></body></html>`);
});

demoRouter.get('/api/debug', (_req: Request, res: Response) => {
  res.json({
    version: '5.0.0-ts',
    stateFile: CONFIG.stateFile,
    orders: DB.orders.map((o) => ({
      order_sn: o.order_sn,
      order_status: o.order_status,
      tracking_no: o.tracking_no,
      tracking_db: DB.trackingNumbers[o.order_sn] || null,
      label_status: DB.labelStatus[o.order_sn] || null,
      delivery_step: DB.deliveryStatus[o.order_sn] ?? null,
      update_time: o.update_time,
      create_time: o.create_time,
    })),
    trackingNumbers: DB.trackingNumbers,
    labelStatus: DB.labelStatus,
    deliveryStatus: DB.deliveryStatus,
    syncedProducts: Object.keys(DB.syncedProducts).length,
    now: ts(),
  });
});

demoRouter.post('/webhook/push', (_req: Request, res: Response) => {
  res.json({ code: 0, message: 'success', request_id: rid() });
});
