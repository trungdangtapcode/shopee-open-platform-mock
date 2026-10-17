import { Request, Response } from "express";
import { ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { rid, verifySignature } from "../utils";
import { BaseManager } from "./base.manager";

export class PaymentManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get("/get_payment_method_list", this.getPaymentMethodList.bind(this));
    this.router.get("/get_shop_installment_status", this.requireAuth, this.getShopInstallmentStatus.bind(this));
    this.router.get("/get_escrow_detail", this.requireAuth, this.getEscrowDetail.bind(this));
  }

  /**
   * Get available payment methods by region (Public API, auth: false)
   */
  public getPaymentMethodList(req: Request, res: Response): void {
    if (!verifySignature(this.config, req, res)) return;
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: [
        {
          region: "PH",
          payment_method: [
            { payment_method_id: 1, payment_method_name: "Cash on Delivery (COD)" },
            { payment_method_id: 2, payment_method_name: "ShopeePay" },
            { payment_method_id: 3, payment_method_name: "Credit / Debit Card" },
          ],
        },
      ],
    });
  }

  /**
   * Get shop installment status
   */
  public getShopInstallmentStatus(_req: Request, res: Response): void {
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: { installment_status: 0 },
    });
  }

  /**
   * Get escrow / income breakdown for an order
   */
  public getEscrowDetail(req: Request, res: Response): void {
    const orderSn = String(req.query.order_sn || "");
    const order = this.db.orders.find((o) => o.order_sn === orderSn);
    if (!order) {
      res.status(400).json({
        error: "error_not_found",
        message: `Order ${orderSn} not found`,
        request_id: rid(),
      });
      return;
    }
    res.json({
      error: "",
      message: "",
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
        },
      },
    });
  }
}
