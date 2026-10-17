import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { Order, ShopeeMockConfig } from "../schemas";
import { DELIVERY_STEPS, StateStorage } from "../storage";
import { notifyOdooDelivered, nowStr, rid, ts } from "../utils";
import { BaseManager } from "./base.manager";

export class DemoManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get("/", this.renderSellerCentre.bind(this));
    this.router.get("/api/demo/state", this.getState.bind(this));
    this.router.post("/api/demo/ship", this.shipOrder.bind(this));
    this.router.post("/api/demo/new-order", this.createNewOrder.bind(this));
    this.router.post("/api/demo/delivery-step", this.advanceDeliveryStep.bind(this));
    this.router.get("/track/:tracking", this.renderTrackingPage.bind(this));
    this.router.post("/api/demo/reset", this.resetState.bind(this));
    this.router.get("/api/debug", this.getDebugState.bind(this));
    this.router.post("/webhook/push", this.triggerWebhookPush.bind(this));
  }

  public renderSellerCentre(_req: Request, res: Response): void {
    const htmlPath = path.join(this.config.publicDir, "seller-centre.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(fs.readFileSync(htmlPath, "utf8"));
  }

  public getState(_req: Request, res: Response): void {
    res.json({
      shop: this.db.shop,
      products: this.db.products,
      orders: this.db.orders,
      trackingNumbers: this.db.trackingNumbers,
      labelStatus: this.db.labelStatus,
      deliveryStatus: this.db.deliveryStatus,
      deliverySteps: DELIVERY_STEPS,
    });
  }

  public shipOrder(req: Request, res: Response): void {
    const { order_sn } = req.body || {};
    const order = this.db.orders.find((o) => o.order_sn === order_sn);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const tracking = "PHSPX" + Date.now();
    order.tracking_no = tracking;
    order.order_status = "PROCESSED";
    order.update_time = ts();
    this.db.trackingNumbers[order_sn] = tracking;
    this.db.labelStatus[order_sn] = "READY";
    if (!this.db.deliveryStatus[order_sn]) this.db.deliveryStatus[order_sn] = 1;
    this.storage.save();
    res.json({ ok: true, tracking_number: tracking, order_status: "PROCESSED" });
  }

  public createNewOrder(req: Request, res: Response): void {
    const {
      buyer_name = "Juan Dela Cruz",
      buyer_phone = "+639181234567",
      address = "45B Rizal St, Quezon City, Metro Manila 1100",
      district = "Quezon City",
      zipcode = "1100",
      payment = "COD",
      items = [],
    } = req.body || {};

    const sn = "SPX" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + String(this.storage.nextOrderCounter()).padStart(3, "0");
    const itemList = items.length
      ? items.map((it: { item_id: number; qty?: number }) => {
          const prod = this.db.products.find((p) => p.item_id === Number(it.item_id)) || this.db.products[0];
          const qty = Number(it.qty) || 1;
          return {
            item_id: prod.item_id,
            item_name: prod.item_name,
            item_sku: prod.item_sku,
            model_id: 0,
            model_name: "",
            model_sku: "",
            model_quantity_purchased: qty,
            model_original_price: prod.price_info[0].original_price,
            model_discounted_price: prod.price_info[0].current_price,
            wholesale: false,
            weight: parseFloat(prod.weight),
            add_on_deal: false,
            main_item: true,
            add_on_deal_id: 0,
            promotion_type: "",
            promotion_id: 0,
            order_item_id: prod.item_id,
            promotion_group_id: 0,
            image_info: { image_url: prod.image.image_url_list[0] },
          };
        })
      : [
          {
            item_id: 10001,
            item_name: "70% Isopropyl Alcohol 500ml",
            item_sku: "ALC-500ML",
            model_id: 0,
            model_name: "",
            model_sku: "",
            model_quantity_purchased: 1,
            model_original_price: 89.0,
            model_discounted_price: 75.0,
            wholesale: false,
            weight: 0.55,
            add_on_deal: false,
            main_item: true,
            add_on_deal_id: 0,
            promotion_type: "",
            promotion_id: 0,
            order_item_id: 10001,
            promotion_group_id: 0,
            image_info: { image_url: "https://cf.shopee.ph/file/mock_alcohol" },
          },
        ];

    const shipFee = 45.0;
    const itemTotal = itemList.reduce(
      (s: number, i: { model_discounted_price: number; model_quantity_purchased: number }) =>
        s + i.model_discounted_price * i.model_quantity_purchased,
      0
    );
    const totalWeight = Math.round(
      itemList.reduce((s: number, i: { weight: number; model_quantity_purchased: number }) => s + i.weight * i.model_quantity_purchased * 1000, 0)
    );

    const newOrder: Order = {
      order_sn: sn,
      region: "PH",
      currency: "PHP",
      cod: payment === "COD",
      total_amount: itemTotal + shipFee,
      order_status: "READY_TO_SHIP",
      shipping_carrier: "SPX Express",
      payment_method: payment,
      estimated_shipping_fee: shipFee,
      message_to_seller: "",
      create_time: ts(),
      update_time: ts(),
      days_to_ship: 2,
      ship_by_date: ts() + 172800,
      buyer_user_id: Math.floor(90000 + Math.random() * 9999),
      buyer_username: String(buyer_name).toLowerCase().replace(/\s+/g, ".") + ".ph",
      recipient_address: {
        name: buyer_name,
        phone: buyer_phone,
        town: district,
        district,
        city: "Metro Manila",
        state: "Metro Manila",
        region: "PH",
        zipcode,
        full_address: address,
      },
      actual_shipping_fee: shipFee,
      goods_to_declare: false,
      note: "",
      note_update_time: 0,
      item_list: itemList,
      pay_time: ts() - 60,
      dropshipper: "",
      dropshipper_phone: "",
      split_up: false,
      buyer_cancel_reason: "",
      cancel_by: "",
      cancel_reason: "",
      actual_shipping_fee_confirmed: true,
      buyer_cpf_id: "",
      fulfillment_flag: "fulfilled_by_local_seller",
      pickup_done_time: 0,
      package_list: [
        {
          package_number: "PKG" + sn.slice(3),
          logistics_status: "LOGISTICS_READY",
          shipping_carrier: "SPX Express",
          item_list: itemList.map((i: { item_id: number; model_quantity_purchased: number }) => ({
            item_id: i.item_id,
            model_id: 0,
            model_quantity: i.model_quantity_purchased,
          })),
        },
      ],
      invoice_data: null,
      checkout_shipping_carrier: "SPX Express",
      reverse_shipping_fee: 0,
      order_chargeable_weight_gram: totalWeight,
      edt: null,
      prescription_images: [],
      prescription_check_status: null,
      tracking_no: "",
    };

    this.db.orders.unshift(newOrder);
    this.storage.save();
    res.json({ ok: true, order_sn: sn });
  }

  public advanceDeliveryStep(req: Request, res: Response): void {
    const { order_sn, step } = req.body || {};
    const order = this.db.orders.find((o) => o.order_sn === order_sn);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const maxStep = DELIVERY_STEPS.length - 1;
    const current = this.db.deliveryStatus[order_sn] ?? (order.tracking_no ? 1 : 0);
    const next = step !== undefined ? Math.min(Number(step), maxStep) : Math.min(current + 1, maxStep);
    this.db.deliveryStatus[order_sn] = next;

    if (next === maxStep) {
      order.order_status = "COMPLETED";
      order.update_time = ts();
      const tracking = this.db.trackingNumbers[order_sn] || order.tracking_no || "";
      notifyOdooDelivered(this.config, order_sn, tracking);
    } else if (next >= 1) {
      order.order_status = "SHIPPED";
      order.update_time = ts();
    }
    this.storage.save();

    res.json({
      ok: true,
      order_sn,
      delivery_step: next,
      step_info: DELIVERY_STEPS[next],
      order_status: order.order_status,
    });
  }

  public renderTrackingPage(req: Request, res: Response): void {
    const tracking = String(req.params.tracking || "");
    const order = this.db.orders.find((o) => (this.db.trackingNumbers[o.order_sn] || o.tracking_no) === tracking);
    const stepIdx = order ? (this.db.deliveryStatus[order.order_sn] ?? (order.tracking_no ? 1 : 0)) : -1;
    const addr = order?.recipient_address;

    const stepsHtml = DELIVERY_STEPS.map((s, i) => {
      const done = i <= stepIdx;
      const current = i === stepIdx;
      return `
    <div style="display:flex;gap:16px;align-items:flex-start;padding:14px 0;border-bottom:1px solid #f0f0f0">
      <div style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;
        background:${current ? "#EE4D2D" : done ? "#e8f5e9" : "#f5f5f5"};
        border:2px solid ${current ? "#EE4D2D" : done ? "#4caf50" : "#ddd"}">
        ${s.icon}
      </div>
      <div style="flex:1">
        <div style="font-weight:${current ? "700" : "600"};font-size:14px;color:${current ? "#EE4D2D" : done ? "#222" : "#aaa"}">
          ${s.label} ${current ? '<span style="background:#EE4D2D;color:#fff;font-size:10px;padding:2px 7px;border-radius:10px;margin-left:6px">LATEST</span>' : ""}
        </div>
        <div style="font-size:12px;color:${done ? "#666" : "#bbb"};margin-top:2px">${s.desc}</div>
        ${done ? `<div style="font-size:11px;color:#aaa;margin-top:3px">Today, ${nowStr()}</div>` : ""}
      </div>
      <div style="font-size:16px">${done ? "✓" : "○"}</div>
    </div>`;
    }).join("");

    res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>SPX Express Tracking – ${tracking}</title></head>
<body style="background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0">
<div style="background:#EE4D2D;color:#fff;padding:16px 24px;display:flex;align-items:center;gap:12px">
  <span style="font-size:20px;font-weight:800">SPX EXPRESS</span>
  <span style="opacity:.7">|</span>
  <span style="font-size:13px;opacity:.9">Parcel Tracking</span>
  <a href="/" style="margin-left:auto;color:#fff;font-size:12px;text-decoration:none;background:rgba(255,255,255,.2);padding:5px 12px;border-radius:4px">← Back to Seller Centre</a>
</div>
<div style="max-width:560px;margin:28px auto;padding:0 16px">
  ${
    !order
      ? `<div style="background:#fff;border-radius:8px;padding:32px;text-align:center;color:#888">No shipment found for tracking number <strong>${tracking}</strong></div>`
      : `
  <div style="background:#fff;border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,.08);padding:20px 24px;margin-bottom:16px">
    <div style="font-size:11px;color:#888;text-transform:uppercase">Tracking Number</div>
    <div style="font-family:monospace;font-size:18px;font-weight:700;color:#EE4D2D;margin-top:2px">${tracking}</div>
    <div style="margin-top:12px;display:flex;gap:24px;font-size:12px;color:#555">
      <div><span style="color:#aaa">Order SN:</span> <strong>${order.order_sn}</strong></div>
      <div><span style="color:#aaa">Recipient:</span> <strong>${addr?.name || ""}</strong></div>
      <div><span style="color:#aaa">To:</span> <strong>${addr?.district || ""}, ${addr?.city || ""}</strong></div>
    </div>
  </div>
  <div style="background:#fff;border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,.08);padding:8px 24px 16px">${stepsHtml}</div>`
  }
</div>
</body></html>`);
  }

  public resetState(_req: Request, res: Response): void {
    this.storage.reset();
    res.json({ ok: true, message: "Reset to initial state." });
  }

  public getDebugState(_req: Request, res: Response): void {
    res.json({ config: this.config, db: this.db });
  }

  public triggerWebhookPush(req: Request, res: Response): void {
    const { code = 3, data = {} } = req.body || {};
    const event = { code, shop_id: this.config.shopId, timestamp: ts(), data };
    res.json({ error: "", message: "Webhook event simulated.", request_id: rid(), simulated_payload: event });
  }
}
