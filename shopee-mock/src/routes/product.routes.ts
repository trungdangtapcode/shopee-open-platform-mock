import { Request, Response, Router } from 'express';
import { nowStr, parseListParam, rid, ts } from '../config/env';
import { requireAuth } from '../middleware/signature';
import { DB, saveState } from '../store/database';
import { ProductItem } from '../store/types';

export const productRouter = Router();

productRouter.get('/get_item_list', requireAuth, (req: Request, res: Response) => {
  const offset = parseInt(String(req.query.offset || '0'), 10) || 0;
  const pageSize = parseInt(String(req.query.page_size || '50'), 10) || 50;
  const page = DB.products.slice(offset, offset + pageSize);
  const hasMore = offset + pageSize < DB.products.length;
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      item: page.map((p) => ({
        item_id: p.item_id,
        item_status: p.item_status || 'NORMAL',
        update_time: ts(),
      })),
      total_count: DB.products.length,
      has_next_page: hasMore,
      next_offset: hasMore ? offset + pageSize : 0,
    },
  });
});

productRouter.get('/get_item_base_info', requireAuth, (req: Request, res: Response) => {
  const ids = parseListParam(req.query.item_id_list)
    .map(Number)
    .filter(Boolean);
  const items = ids.length ? DB.products.filter((p) => ids.includes(p.item_id)) : DB.products;
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      item_list: items.map((p) => {
        const synced = DB.syncedProducts[p.item_id];
        return {
          item_id: p.item_id,
          item_name: p.name,
          item_status: p.item_status || 'NORMAL',
          item_sku: p.sku,
          sku: p.sku,
          category_id: Number(p.category) || 100002,
          description: p.description || `${p.name} (${p.sku})`,
          create_time: ts() - 86400,
          update_time: ts(),
          price_info: [{ currency: 'PHP', original_price: p.price, current_price: p.price }],
          stock_info_v2: {
            summary_info: {
              total_reserved_stock: 0,
              total_available_stock: synced ? synced.stock : 100,
            },
            seller_stock: [{ location_id: '', stock: synced ? synced.stock : 100 }],
          },
          image: {
            image_id_list: [`img_${p.item_id}`],
            image_url_list: [
              `https://placehold.co/400x400/EE4D2D/fff?text=${encodeURIComponent(p.sku)}`,
            ],
          },
          weight: String(p.weight || 0.5),
          dimension: { package_length: 10, package_width: 10, package_height: 10 },
          has_model: false,
        };
      }),
    },
  });
});

productRouter.get('/get_category', requireAuth, (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { category_list: DB.categories },
  });
});

productRouter.get('/get_attribute_tree', requireAuth, (req: Request, res: Response) => {
  const catIds = parseListParam(req.query.category_id_list).map(Number);
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      list: (catIds.length ? catIds : [100002]).map((cid) => ({
        category_id: cid,
        attribute_tree: [
          {
            attribute_id: 2001,
            mandatory: false,
            name: 'Brand',
            input_type: 1,
            input_validation_type: 2,
            format_type: 1,
            attribute_value_list: [{ value_id: 0, name: 'NoBrand' }],
          },
        ],
      })),
    },
  });
});

productRouter.get('/get_brand_list', requireAuth, (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      brand_list: [
        { brand_id: 0, original_brand_name: 'NoBrand', display_brand_name: 'NoBrand' },
        { brand_id: 101, original_brand_name: 'Unilab', display_brand_name: 'Unilab' },
      ],
      has_next_page: false,
      next_offset: 0,
      is_mandatory: false,
      input_type: 'DROP_DOWN',
    },
  });
});

productRouter.get('/get_item_limit', requireAuth, (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      price_limit: { min_limit: 1, max_limit: 1000000 },
      wholesale_price_threshold_percentage: { min_limit: 1, max_limit: 99 },
      stock_limit: { min_limit: 0, max_limit: 100000 },
      item_name_length_limit: { min_limit: 1, max_limit: 120 },
      item_description_length_limit: { min_limit: 20, max_limit: 3000 },
      item_image_count_limit: { min_limit: 1, max_limit: 9 },
    },
  });
});

productRouter.get('/get_boosted_list', requireAuth, (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      item_list: DB.boostedItems.map((id) => ({ item_id: id, cool_down_second: 14400 })),
    },
  });
});

productRouter.post('/boost_item', requireAuth, (req: Request, res: Response) => {
  const { item_id_list } = req.body || {};
  const list: number[] = Array.isArray(item_id_list) ? item_id_list.map(Number) : [];
  for (const id of list) {
    if (!DB.boostedItems.includes(id)) DB.boostedItems.push(id);
  }
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      failure_list: [],
      success_list: { item_id_list: list },
    },
  });
});

productRouter.get('/category_recommend', requireAuth, (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { category_id: [100002, 100001] },
  });
});

productRouter.get('/get_recommend_attribute', requireAuth, (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { attribute_list: [{ attribute_id: 2001, value_id: 0 }] },
  });
});

productRouter.post('/add_item', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  const newItemId =
    DB.products.reduce((max, p) => Math.max(max, p.item_id), 10000) + 1;
  const price = Number(body.original_price) || 100;
  const stock =
    body.seller_stock && body.seller_stock[0]
      ? Number(body.seller_stock[0].stock)
      : Number(body.normal_stock) || 50;

  const newProduct: ProductItem = {
    item_id: newItemId,
    model_id: 0,
    name: body.item_name || `New Item #${newItemId}`,
    sku: body.item_sku || `SKU-${newItemId}`,
    price,
    category: body.category_id || 100002,
    description: body.description || '',
    item_status: body.item_status || 'NORMAL',
    weight: body.weight || 0.5,
  };
  DB.products.push(newProduct);
  DB.syncedProducts[newItemId] = {
    item_id: newItemId,
    sku: newProduct.sku,
    name: newProduct.name,
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
      category_id: Number(newProduct.category),
      item_name: newProduct.name,
      description: newProduct.description,
      item_sku: newProduct.sku,
      create_time: ts(),
      update_time: ts(),
      weight: newProduct.weight,
      item_status: newProduct.item_status,
      price_info: { current_price: price, original_price: price },
      stock_info_v2: {
        summary_info: { total_reserved_stock: 0, total_available_stock: stock },
        seller_stock: [{ location_id: '', stock }],
      },
    },
  });
});

productRouter.post('/update_item', requireAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  const itemId = Number(body.item_id);
  const product = DB.products.find((p) => p.item_id === itemId);
  if (!product) {
    res.status(400).json({
      error: 'product.error_not_found',
      message: `Item ${itemId} not found`,
      request_id: rid(),
    });
    return;
  }
  if (body.item_name !== undefined) product.name = body.item_name;
  if (body.description !== undefined) product.description = body.description;
  if (body.item_sku !== undefined) product.sku = body.item_sku;
  if (body.item_status !== undefined) product.item_status = body.item_status;
  saveState();

  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      item_id: product.item_id,
      item_name: product.name,
      description: product.description || '',
      item_sku: product.sku,
      item_status: product.item_status || 'NORMAL',
      update_time: ts(),
    },
  });
});

productRouter.post('/update_price', requireAuth, (req: Request, res: Response) => {
  const { item_id, price_list } = req.body || {};
  const itemId = Number(item_id);
  const product = DB.products.find((p) => p.item_id === itemId);
  if (product && Array.isArray(price_list) && price_list[0]) {
    product.price = Number(price_list[0].original_price) || product.price;
    saveState();
  }
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      failure_list: [],
      success_list: (price_list || []).map((pl: Record<string, unknown>) => ({
        model_id: pl.model_id || 0,
        original_price: pl.original_price,
      })),
    },
  });
});

productRouter.post('/update_stock', requireAuth, (req: Request, res: Response) => {
  const { item_id, stock_list } = req.body || {};
  const itemId = Number(item_id);
  let newStock = 0;
  if (Array.isArray(stock_list) && stock_list[0]) {
    const entry = stock_list[0];
    newStock = entry.seller_stock
      ? Number(entry.seller_stock[0].stock)
      : entry.normal_stock !== undefined
      ? Number(entry.normal_stock)
      : 0;
    const product = DB.products.find((p) => p.item_id === itemId);
    const sku = product ? product.sku : `ITEM-${itemId}`;
    const name = product ? product.name : `Product #${itemId}`;
    DB.syncedProducts[itemId] = {
      item_id: itemId,
      sku,
      name,
      stock: newStock,
      source: 'api',
      last_sync: nowStr(),
    };
    saveState();
  }
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      item_id: itemId,
      update_time: ts(),
      failure_list: [],
      success_list: (stock_list || []).map((sl: Record<string, unknown>) => ({
        model_id: sl.model_id || 0,
        location_id:
          (Array.isArray(sl.seller_stock) &&
            sl.seller_stock[0] &&
            (sl.seller_stock[0] as Record<string, unknown>).location_id) ||
          '',
        stock: newStock,
      })),
    },
  });
});

productRouter.post('/delete_item', requireAuth, (req: Request, res: Response) => {
  const { item_id } = req.body || {};
  const itemId = Number(item_id);
  const idx = DB.products.findIndex((p) => p.item_id === itemId);
  if (idx !== -1) {
    DB.products.splice(idx, 1);
    delete DB.syncedProducts[itemId];
    saveState();
  }
  res.json({ error: '', message: '', request_id: rid(), response: {} });
});
