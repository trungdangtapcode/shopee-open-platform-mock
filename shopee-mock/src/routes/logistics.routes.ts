import { Request, Response, Router } from 'express';
import { parseListParam, rid, ts } from '../config/env';
import { requireAuth } from '../middleware/signature';
import { buildShippingLabelPDF } from '../services/pdf-label.service';
import { DB, saveState } from '../store/database';

export const logisticsRouter = Router();

logisticsRouter.get('/get_channel_list', requireAuth, (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      logistics_channel_list: [
        {
          logistics_channel_id: 2001,
          logistics_channel_name: 'SPX Express',
          cod_enabled: true,
          enabled: true,
          fee_type: 'SIZE_INPUT',
          size_list: [],
          weight_limit: { item_max_weight: 50, item_min_weight: 0.01 },
          item_max_dimension: { height: 100, width: 100, length: 100, unit: 'cm', dimension_sum: 300 },
          volume_limit: { item_max_volume: 1000000, item_min_volume: 1 },
          logistics_description: 'Standard Local via SPX Express',
          force_enable: false,
          mask_channel_id: 0,
          block_seller_cover_shipping_fee: false,
          support_cross_border: false,
        },
        {
          logistics_channel_id: 2002,
          logistics_channel_name: 'J&T Express',
          cod_enabled: true,
          enabled: true,
          fee_type: 'SIZE_INPUT',
          size_list: [],
          weight_limit: { item_max_weight: 50, item_min_weight: 0.01 },
          item_max_dimension: { height: 100, width: 100, length: 100, unit: 'cm', dimension_sum: 300 },
          volume_limit: { item_max_volume: 1000000, item_min_volume: 1 },
          logistics_description: 'Standard Local via J&T Express',
          force_enable: false,
          mask_channel_id: 0,
          block_seller_cover_shipping_fee: false,
          support_cross_border: false,
        },
      ],
    },
  });
});

logisticsRouter.get('/get_shipping_parameter', requireAuth, (req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      order_sn: req.query.order_sn,
      info_needed: { pickup: ['address_id', 'pickup_time_id'], dropoff: [], non_integrated: [] },
      pickup: {
        address_list: [
          {
            address_id: 1,
            address: '123 Mock Warehouse St, Manila, PH',
            time_slot_list: [
              {
                pickup_time_id: 'slot_001',
                date: new Date().toISOString().split('T')[0],
                time_text: '9:00 AM - 12:00 PM',
              },
            ],
          },
        ],
      },
      dropoff: { branch_list: [] },
      non_integrated: null,
    },
  });
});

logisticsRouter.get('/get_tracking_number', requireAuth, (req: Request, res: Response) => {
  const orderSn = String(req.query.order_sn || '');
  if (!DB.trackingNumbers[orderSn]) {
    DB.trackingNumbers[orderSn] = 'PHSPX' + Date.now();
    const order = DB.orders.find((o) => o.order_sn === orderSn);
    if (order) order.tracking_no = DB.trackingNumbers[orderSn];
    saveState();
  }
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { tracking_number: DB.trackingNumbers[orderSn], plp_number: '', hint_message: '' },
  });
});

logisticsRouter.post('/ship_order', requireAuth, (req: Request, res: Response) => {
  const { order_sn } = req.body || {};
  const order = DB.orders.find((o) => o.order_sn === order_sn);
  if (!order) {
    res.json({
      error: 'order_not_found',
      message: `Order ${order_sn} not found.`,
      request_id: rid(),
      response: {},
    });
    return;
  }
  const tracking = 'PHSPX' + Date.now();
  order.tracking_no = tracking;
  order.order_status = 'PROCESSED';
  order.update_time = ts();
  DB.trackingNumbers[order_sn] = tracking;
  DB.deliveryStatus[order_sn] = 1;
  saveState();
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { hint_message: 'Shipment initiated successfully.' },
  });
});

logisticsRouter.post('/init_shipment', requireAuth, (req: Request, res: Response) => {
  const { order_sn } = req.body || {};
  const order = DB.orders.find((o) => o.order_sn === order_sn);
  if (!order) {
    res.json({
      error: 'order_not_found',
      message: `Order ${order_sn} not found.`,
      request_id: rid(),
      response: {},
    });
    return;
  }
  const tracking = 'PHSPX' + Date.now();
  order.tracking_no = tracking;
  order.order_status = 'PROCESSED';
  order.update_time = ts();
  DB.trackingNumbers[order_sn] = tracking;
  DB.deliveryStatus[order_sn] = 1;
  saveState();
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { order_sn, tracking_number: tracking, hint_message: 'Shipment initiated successfully.' },
  });
});

logisticsRouter.post('/get_shipping_document_parameter', requireAuth, (req: Request, res: Response) => {
  const { order_list } = req.body || {};
  const invalidOrder = (order_list || []).find((o: { order_sn?: string }) => {
    const sn = String(o.order_sn || '');
    return sn.includes('NONEXISTENT') || sn.includes('DUMMY') || sn === '1234567890ABCDEF';
  });
  if (invalidOrder) {
    res.status(400).json({
      error: 'logistics.order_not_exist',
      message: `Order ${invalidOrder.order_sn} does not exist.`,
      request_id: rid(),
    });
    return;
  }
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      result_list: (order_list || []).map((o: { order_sn: string; package_number?: string }) => ({
        order_sn: o.order_sn,
        package_number: o.package_number || '',
        suggest_shipping_document_type: 'NORMAL_AIR_WAYBILL',
        selectable_shipping_document_type: ['NORMAL_AIR_WAYBILL', 'THERMAL_AIR_WAYBILL'],
      })),
    },
  });
});

logisticsRouter.post('/create_shipping_document', requireAuth, (req: Request, res: Response) => {
  const { order_list } = req.body || {};
  const invalidOrder = (order_list || []).find(
    (o: { order_sn?: string }) =>
      String(o.order_sn).includes('NONEXISTENT') || String(o.order_sn).includes('DUMMY')
  );
  if (invalidOrder) {
    res.status(400).json({
      error: 'logistics.order_not_exist',
      message: `Order ${invalidOrder.order_sn} does not exist.`,
      request_id: rid(),
    });
    return;
  }
  const result_list = (order_list || []).map((o: { order_sn: string }) => {
    if (!DB.trackingNumbers[o.order_sn]) {
      DB.trackingNumbers[o.order_sn] = 'PHSPX' + Date.now();
      const order = DB.orders.find((ord) => ord.order_sn === o.order_sn);
      if (order) order.tracking_no = DB.trackingNumbers[o.order_sn];
    }
    DB.labelStatus[o.order_sn] = 'READY';
    return { order_sn: o.order_sn, status: 'READY', fail_error: '', fail_message: '' };
  });
  saveState();
  res.json({ error: '', message: '', request_id: rid(), response: { result_list } });
});

function buildDocResultList(orderList: Array<{ order_sn: string }>): Array<Record<string, string>> {
  return orderList.map((o) => {
    if (!DB.trackingNumbers[o.order_sn]) {
      DB.trackingNumbers[o.order_sn] = 'PHSPX' + Date.now();
      const order = DB.orders.find((ord) => ord.order_sn === o.order_sn);
      if (order) order.tracking_no = DB.trackingNumbers[o.order_sn];
    }
    if (!DB.labelStatus[o.order_sn] || DB.labelStatus[o.order_sn] === 'PROCESSING') {
      DB.labelStatus[o.order_sn] = 'READY';
    }
    return {
      order_sn: o.order_sn,
      status: DB.labelStatus[o.order_sn],
      fail_error: '',
      fail_message: '',
    };
  });
}

logisticsRouter.post('/get_shipping_document_result', requireAuth, (req: Request, res: Response) => {
  const result_list = buildDocResultList(req.body.order_list || []);
  saveState();
  res.json({ error: '', message: '', request_id: rid(), response: { result_list } });
});

logisticsRouter.get('/get_shipping_document_result', requireAuth, (req: Request, res: Response) => {
  let ol: Array<{ order_sn: string }> = [];
  try {
    ol = JSON.parse(String(req.query.order_list || '[]'));
  } catch (_) {}
  const result_list = buildDocResultList(ol);
  saveState();
  res.json({ error: '', message: '', request_id: rid(), response: { result_list } });
});

async function handleDownloadShippingDocument(req: Request, res: Response): Promise<void> {
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
    res.json({ error: '', message: '', request_id: rid(), response: { result_list: [] } });
    return;
  }

  const firstItem = orderList[0];
  const orderSn = typeof firstItem === 'string' ? firstItem : firstItem.order_sn;
  const order = DB.orders.find((o) => o.order_sn === orderSn) || DB.orders[0];
  if (!order) {
    res.json({ error: 'label_error', message: 'Order not found', request_id: rid(), response: {} });
    return;
  }

  if (!DB.trackingNumbers[order.order_sn]) {
    DB.trackingNumbers[order.order_sn] = 'PHSPX' + Date.now();
    order.tracking_no = DB.trackingNumbers[order.order_sn];
  }
  if (order.order_status === 'READY_TO_SHIP') {
    order.order_status = 'PROCESSED';
    order.update_time = ts();
    DB.deliveryStatus[order.order_sn] = 1;
  }
  DB.labelStatus[order.order_sn] = 'STORED';
  saveState();

  const pdfBuffer = await buildShippingLabelPDF(order, DB.trackingNumbers[order.order_sn]);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Length', String(pdfBuffer.length));
  res.send(pdfBuffer);
}

logisticsRouter.post('/download_shipping_document', requireAuth, handleDownloadShippingDocument);
logisticsRouter.get('/download_shipping_document', requireAuth, handleDownloadShippingDocument);

logisticsRouter.post('/download_shipping_document_job', requireAuth, (req: Request, res: Response) => {
  const { job_id } = req.body || {};
  if (!job_id || String(job_id).includes('DUMMY')) {
    res.status(400).json({
      error: 'logistics.error_param',
      message: `Invalid or unknown job_id: ${job_id}`,
      request_id: rid(),
    });
    return;
  }
  res.json({ error: '', message: '', request_id: rid(), response: { job_id } });
});
