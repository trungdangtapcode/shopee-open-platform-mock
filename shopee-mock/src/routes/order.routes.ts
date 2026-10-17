import { Request, Response, Router } from 'express';
import { parseListParam, rid, ts } from '../config/env';
import { requireAuth } from '../middleware/signature';
import { DB } from '../store/database';

export const orderRouter = Router();

orderRouter.get('/get_order_list', requireAuth, (req: Request, res: Response) => {
  const orderStatus = req.query.order_status ? String(req.query.order_status) : undefined;
  const pageSize = parseInt(String(req.query.page_size || '20'), 10) || 20;
  const cursor = req.query.cursor ? String(req.query.cursor) : '';

  const nowTs = ts();
  DB.orders.forEach((o) => {
    o.update_time = nowTs - 30;
  });

  const orders = orderStatus
    ? DB.orders.filter((o) => o.order_status === orderStatus)
    : DB.orders;

  const startIdx = cursor ? DB.orders.findIndex((o) => o.order_sn === cursor) + 1 : 0;
  const page = orders.slice(startIdx, startIdx + pageSize);
  const hasMore = startIdx + pageSize < orders.length;
  const nextCursor = hasMore ? page[page.length - 1].order_sn : '';

  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      order_list: page.map((o) => ({
        order_sn: o.order_sn,
        order_status: o.order_status,
        create_time: o.create_time,
        update_time: o.update_time,
      })),
      more: hasMore,
      next_cursor: nextCursor,
      total_count: orders.length,
    },
  });
});

orderRouter.get('/get_order_detail', requireAuth, (req: Request, res: Response) => {
  const sns = parseListParam(req.query.order_sn_list);
  const list = sns.length ? DB.orders.filter((o) => sns.includes(o.order_sn)) : DB.orders;
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      order_list: list.map((o) => ({
        ...o,
        message_to_seller: '',
        note: '',
        pay_time: o.create_time + 300,
        days_to_ship: 3,
        ship_by_date: o.create_time + 86400 * 3,
        invoice_data: null,
        checkout_shipping_carrier: o.shipping_carrier,
        actual_shipping_cost: 0,
      })),
    },
  });
});
