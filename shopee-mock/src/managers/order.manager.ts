import { Request, Response } from "express";
import { ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { parseListParam, rid, ts } from "../utils";
import { BaseManager } from "./base.manager";

export class OrderManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get("/get_order_list", this.requireAuth, this.getOrderList.bind(this));
    this.router.get("/get_order_detail", this.requireAuth, this.getOrderDetail.bind(this));
    this.router.get("/get_shipment_list", this.requireAuth, this.getShipmentList.bind(this));
    this.router.post("/cancel_order", this.requireAuth, this.cancelOrder.bind(this));
  }

  /**
   * Get order list filtered by time range and status
   */
  public getOrderList(req: Request, res: Response): void {
    const { order_status, page_size = "20", cursor = "" } = req.query;
    const timeFrom = parseInt(String(req.query.time_from || "0"), 10) || 0;
    const timeTo = parseInt(String(req.query.time_to || String(ts() + 86400)), 10);

    let list = this.db.orders.filter((o) => o.create_time >= timeFrom && o.create_time <= timeTo);
    if (order_status && order_status !== "ALL") {
      list = list.filter((o) => o.order_status === order_status);
    }

    const offset = cursor ? parseInt(String(cursor), 10) : 0;
    const ps = parseInt(String(page_size), 10);
    const page = list.slice(offset, offset + ps);

    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        more: offset + ps < list.length,
        next_cursor: offset + ps < list.length ? String(offset + ps) : "",
        order_list: page.map((o) => ({ order_sn: o.order_sn, order_status: o.order_status })),
      },
    });
  }

  /**
   * Get full order details by order_sn_list
   */
  public getOrderDetail(req: Request, res: Response): void {
    const sns = parseListParam(req.query.order_sn_list);
    const found = this.db.orders.filter((o) => sns.includes(o.order_sn));
    res.json({ error: "", message: "", request_id: rid(), response: { order_list: found } });
  }

  /**
   * Get orders ready to ship
   */
  public getShipmentList(_req: Request, res: Response): void {
    const ready = this.db.orders.filter((o) => o.order_status === "READY_TO_SHIP");
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        more: false,
        next_cursor: "",
        order_list: ready.map((o) => ({
          order_sn: o.order_sn,
          package_number: o.package_list[0]?.package_number || "",
        })),
      },
    });
  }

  /**
   * Cancel an order by order_sn
   */
  public cancelOrder(req: Request, res: Response): void {
    const { order_sn, cancel_reason } = req.body || {};
    const order = this.db.orders.find((o) => o.order_sn === order_sn);
    if (order) {
      order.order_status = "CANCELLED";
      order.cancel_reason = cancel_reason || "OUT_OF_STOCK";
      order.cancel_by = "seller";
      order.update_time = ts();
      this.storage.save();
    }
    res.json({ error: "", message: "", request_id: rid(), response: { update_time: ts() } });
  }
}
