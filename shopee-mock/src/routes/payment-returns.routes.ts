import { Request, Response, Router } from 'express';
import { rid } from '../config/env';
import { requireAuth } from '../middleware/signature';
import { DB } from '../store/database';

export const paymentRouter = Router();
export const returnsRouter = Router();

paymentRouter.get('/get_payment_method_list', (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: [
      {
        region: 'PH',
        payment_method: [
          { payment_method_id: 1, payment_method_name: 'Cash on Delivery (COD)' },
          { payment_method_id: 2, payment_method_name: 'ShopeePay' },
          { payment_method_id: 3, payment_method_name: 'Credit / Debit Card' },
        ],
      },
    ],
  });
});

paymentRouter.get('/get_shop_installment_status', requireAuth, (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { installment_status: 0 },
  });
});

paymentRouter.get('/get_escrow_detail', requireAuth, (req: Request, res: Response) => {
  const orderSn = String(req.query.order_sn || '');
  const order = DB.orders.find((o) => o.order_sn === orderSn);
  if (!order) {
    res.status(400).json({
      error: 'error_not_found',
      message: `Order ${orderSn} not found`,
      request_id: rid(),
    });
    return;
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
      },
    },
  });
});

returnsRouter.get('/get_return_list', requireAuth, (req: Request, res: Response) => {
  const pageNo = Math.max(1, parseInt(String(req.query.page_no || '1'), 10) || 1);
  const pageSize = Math.max(1, parseInt(String(req.query.page_size || '20'), 10) || 20);
  const start = (pageNo - 1) * pageSize;
  const page = DB.returns.slice(start, start + pageSize);
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      return: page,
      more: start + pageSize < DB.returns.length,
    },
  });
});

returnsRouter.get('/get_return_detail', requireAuth, (req: Request, res: Response) => {
  const returnSn = String(req.query.return_sn || '');
  const found = DB.returns.find((r) => r.return_sn === returnSn);
  if (!found) {
    res.status(400).json({
      error: 'returns.return_not_exist',
      message: `Return ${returnSn} does not exist.`,
      request_id: rid(),
    });
    return;
  }
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: found,
  });
});
