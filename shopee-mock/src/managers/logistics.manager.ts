import { Request, Response } from "express";
import { ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { buildShippingLabelPDF, parseListParam, rid, ts } from "../utils";
import { BaseManager } from "./base.manager";

export class LogisticsManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get("/get_channel_list", this.requireAuth, this.getChannelList.bind(this));
    this.router.get("/get_shipping_parameter", this.requireAuth, this.getShippingParameter.bind(this));
    this.router.get("/get_tracking_number", this.requireAuth, this.getTrackingNumber.bind(this));
    this.router.post("/ship_order", this.requireAuth, this.shipOrder.bind(this));
    this.router.post("/init_shipment", this.requireAuth, this.initShipment.bind(this));
    this.router.post("/get_shipping_document_parameter", this.requireAuth, this.getShippingDocumentParameter.bind(this));
    this.router.post("/create_shipping_document", this.requireAuth, this.createShippingDocument.bind(this));
    this.router.post("/get_shipping_document_result", this.requireAuth, this.getShippingDocumentResultPost.bind(this));
    this.router.get("/get_shipping_document_result", this.requireAuth, this.getShippingDocumentResultGet.bind(this));
    this.router.post("/download_shipping_document", this.requireAuth, this.downloadShippingDocument.bind(this));
    this.router.get("/download_shipping_document", this.requireAuth, this.downloadShippingDocument.bind(this));
    this.router.post("/download_shipping_document_job", this.requireAuth, this.downloadShippingDocumentJob.bind(this));
  }

  public getChannelList(_req: Request, res: Response): void {
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        logistics_channel_list: [
          {
            logistics_channel_id: 2001,
            logistics_channel_name: "SPX Express",
            cod_enabled: true,
            enabled: true,
            fee_type: "SIZE_INPUT",
            size_list: [],
            weight_limit: { item_max_weight: 50, item_min_weight: 0.01 },
            item_max_dimension: { height: 100, width: 100, length: 100, unit: "cm", dimension_sum: 300 },
            volume_limit: { item_max_volume: 1000000, item_min_volume: 1 },
            logistics_description: "Standard Local via SPX Express",
            force_enable: false,
            mask_channel_id: 0,
            block_seller_cover_shipping_fee: false,
            support_cross_border: false,
          },
          {
            logistics_channel_id: 2002,
            logistics_channel_name: "J&T Express",
            cod_enabled: true,
            enabled: true,
            fee_type: "SIZE_INPUT",
            size_list: [],
            weight_limit: { item_max_weight: 50, item_min_weight: 0.01 },
            item_max_dimension: { height: 100, width: 100, length: 100, unit: "cm", dimension_sum: 300 },
            volume_limit: { item_max_volume: 1000000, item_min_volume: 1 },
            logistics_description: "Standard Local via J&T Express",
            force_enable: false,
            mask_channel_id: 0,
            block_seller_cover_shipping_fee: false,
            support_cross_border: false,
          },
        ],
      },
    });
  }

  public getShippingParameter(req: Request, res: Response): void {
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        order_sn: req.query.order_sn,
        info_needed: { pickup: ["address_id", "pickup_time_id"], dropoff: [], non_integrated: [] },
        pickup: {
          address_list: [
            {
              address_id: 1,
              address: "123 Mock Warehouse St, Manila, PH",
              time_slot_list: [
                {
                  pickup_time_id: "slot_001",
                  date: new Date().toISOString().split("T")[0],
                  time_text: "9:00 AM - 12:00 PM",
                },
              ],
            },
          ],
        },
        dropoff: { branch_list: [] },
        non_integrated: null,
      },
    });
  }

  public getTrackingNumber(req: Request, res: Response): void {
    const orderSn = String(req.query.order_sn || "");
    if (!this.db.trackingNumbers[orderSn]) {
      this.db.trackingNumbers[orderSn] = "PHSPX" + Date.now();
      const order = this.db.orders.find((o) => o.order_sn === orderSn);
      if (order) order.tracking_no = this.db.trackingNumbers[orderSn];
      this.storage.save();
    }
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: { tracking_number: this.db.trackingNumbers[orderSn], plp_number: "", hint_message: "" },
    });
  }

  public shipOrder(req: Request, res: Response): void {
    const { order_sn } = req.body || {};
    const order = this.db.orders.find((o) => o.order_sn === order_sn);
    if (!order) {
      res.json({ error: "order_not_found", message: `Order ${order_sn} not found.`, request_id: rid(), response: {} });
      return;
    }
    const tracking = "PHSPX" + Date.now();
    order.tracking_no = tracking;
    order.order_status = "PROCESSED";
    order.update_time = ts();
    this.db.trackingNumbers[order_sn] = tracking;
    this.db.deliveryStatus[order_sn] = 1;
    this.storage.save();
    res.json({ error: "", message: "", request_id: rid(), response: { hint_message: "Shipment initiated successfully." } });
  }

  public initShipment(req: Request, res: Response): void {
    const { order_sn } = req.body || {};
    const order = this.db.orders.find((o) => o.order_sn === order_sn);
    if (!order) {
      res.json({ error: "order_not_found", message: `Order ${order_sn} not found.`, request_id: rid(), response: {} });
      return;
    }
    const tracking = "PHSPX" + Date.now();
    order.tracking_no = tracking;
    order.order_status = "PROCESSED";
    order.update_time = ts();
    this.db.trackingNumbers[order_sn] = tracking;
    this.db.deliveryStatus[order_sn] = 1;
    this.storage.save();
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: { order_sn, tracking_number: tracking, hint_message: "Shipment initiated successfully." },
    });
  }

  public getShippingDocumentParameter(req: Request, res: Response): void {
    const { order_list } = req.body || {};
    const invalidOrder = (order_list || []).find((o: { order_sn?: string }) => {
      const sn = String(o.order_sn || "");
      return sn.includes("NONEXISTENT") || sn.includes("DUMMY") || sn === "1234567890ABCDEF";
    });
    if (invalidOrder) {
      res.status(400).json({
        error: "logistics.order_not_exist",
        message: `Order ${invalidOrder.order_sn} does not exist.`,
        request_id: rid(),
      });
      return;
    }
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        result_list: (order_list || []).map((o: { order_sn: string; package_number?: string }) => ({
          order_sn: o.order_sn,
          package_number: o.package_number || "",
          suggest_shipping_document_type: "NORMAL_AIR_WAYBILL",
          selectable_shipping_document_type: ["NORMAL_AIR_WAYBILL", "THERMAL_AIR_WAYBILL"],
        })),
      },
    });
  }

  public createShippingDocument(req: Request, res: Response): void {
    const { order_list } = req.body || {};
    const invalidOrder = (order_list || []).find(
      (o: { order_sn?: string }) =>
        String(o.order_sn).includes("NONEXISTENT") || String(o.order_sn).includes("DUMMY")
    );
    if (invalidOrder) {
      res.status(400).json({
        error: "logistics.order_not_exist",
        message: `Order ${invalidOrder.order_sn} does not exist.`,
        request_id: rid(),
      });
      return;
    }
    const result_list = (order_list || []).map((o: { order_sn: string }) => {
      if (!this.db.trackingNumbers[o.order_sn]) {
        this.db.trackingNumbers[o.order_sn] = "PHSPX" + Date.now();
        const order = this.db.orders.find((ord) => ord.order_sn === o.order_sn);
        if (order) order.tracking_no = this.db.trackingNumbers[o.order_sn];
      }
      this.db.labelStatus[o.order_sn] = "READY";
      return { order_sn: o.order_sn, status: "READY", fail_error: "", fail_message: "" };
    });
    this.storage.save();
    res.json({ error: "", message: "", request_id: rid(), response: { result_list } });
  }

  private buildDocResultList(orderList: Array<{ order_sn: string }>): Array<Record<string, string>> {
    return orderList.map((o) => {
      if (!this.db.trackingNumbers[o.order_sn]) {
        this.db.trackingNumbers[o.order_sn] = "PHSPX" + Date.now();
        const order = this.db.orders.find((ord) => ord.order_sn === o.order_sn);
        if (order) order.tracking_no = this.db.trackingNumbers[o.order_sn];
      }
      if (!this.db.labelStatus[o.order_sn] || this.db.labelStatus[o.order_sn] === "PROCESSING") {
        this.db.labelStatus[o.order_sn] = "READY";
      }
      return { order_sn: o.order_sn, status: this.db.labelStatus[o.order_sn], fail_error: "", fail_message: "" };
    });
  }

  public getShippingDocumentResultPost(req: Request, res: Response): void {
    const result_list = this.buildDocResultList(req.body.order_list || []);
    this.storage.save();
    res.json({ error: "", message: "", request_id: rid(), response: { result_list } });
  }

  public getShippingDocumentResultGet(req: Request, res: Response): void {
    let ol: Array<{ order_sn: string }> = [];
    try {
      ol = JSON.parse(String(req.query.order_list || "[]"));
    } catch (_) {}
    const result_list = this.buildDocResultList(ol);
    this.storage.save();
    res.json({ error: "", message: "", request_id: rid(), response: { result_list } });
  }

  public async downloadShippingDocument(req: Request, res: Response): Promise<void> {
    let orderList: Array<{ order_sn: string } | string> = [];
    if (req.body && Array.isArray(req.body.order_list) && req.body.order_list.length) {
      orderList = req.body.order_list;
    } else if (req.query.order_sn_list) {
      orderList = parseListParam(req.query.order_sn_list).map((s) => ({ order_sn: s }));
    } else if (req.query.order_list) {
      try {
        orderList = JSON.parse(String(req.query.order_list));
      } catch (_) {}
    }

    if (!orderList.length) {
      res.json({ error: "", message: "", request_id: rid(), response: { result_list: [] } });
      return;
    }

    const firstItem = orderList[0];
    const orderSn = typeof firstItem === "string" ? firstItem : firstItem.order_sn;
    const order = this.db.orders.find((o) => o.order_sn === orderSn) || this.db.orders[0];
    const tracking = this.db.trackingNumbers[orderSn] || order.tracking_no || "PHSPX0000000001";

    try {
      const pdfBuf = await buildShippingLabelPDF(order, this.db.shop, tracking);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="shipping_label_${orderSn}.pdf"`);
      res.setHeader("Content-Length", pdfBuf.length);
      res.end(pdfBuf);
    } catch (err) {
      const error = err as Error;
      res.status(500).json({ error: "pdf_generation_failed", message: error.message, request_id: rid() });
    }
  }

  public async downloadShippingDocumentJob(req: Request, res: Response): Promise<void> {
    const jobId = String(req.body?.job_id || req.query.job_id || "");
    if (!jobId || jobId.includes("NONEXISTENT") || jobId.includes("DUMMY")) {
      res.status(400).json({
        error: "logistics.job_not_exist",
        message: `Shipping document job ${jobId} not found.`,
        request_id: rid(),
      });
      return;
    }
    const order = this.db.orders[0];
    const tracking = this.db.trackingNumbers[order.order_sn] || order.tracking_no || "PHSPX0000000001";
    const pdfBuf = await buildShippingLabelPDF(order, this.db.shop, tracking);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="job_${jobId}.pdf"`);
    res.end(pdfBuf);
  }
}
