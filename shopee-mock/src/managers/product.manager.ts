import { Request, Response } from "express";
import { ProductItem, ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { parseListParam, rid, ts } from "../utils";
import { BaseManager } from "./base.manager";

export class ProductManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get("/get_category", this.requireAuth, this.getCategory.bind(this));
    this.router.get("/get_attribute_tree", this.requireAuth, this.getAttributeTree.bind(this));
    this.router.get("/get_brand_list", this.requireAuth, this.getBrandList.bind(this));
    this.router.get("/get_item_limit", this.requireAuth, this.getItemLimit.bind(this));
    this.router.get("/category_recommend", this.requireAuth, this.categoryRecommend.bind(this));
    this.router.get("/get_recommend_attribute", this.requireAuth, this.getRecommendAttribute.bind(this));
    this.router.get("/get_item_list", this.requireAuth, this.getItemList.bind(this));
    this.router.get("/get_item_base_info", this.requireAuth, this.getItemBaseInfo.bind(this));
    this.router.get("/get_boosted_list", this.requireAuth, this.getBoostedList.bind(this));
    this.router.post("/boost_item", this.requireAuth, this.boostItem.bind(this));
    this.router.post("/add_item", this.requireAuth, this.addItem.bind(this));
    this.router.post("/update_item", this.requireAuth, this.updateItem.bind(this));
    this.router.post("/delete_item", this.requireAuth, this.deleteItem.bind(this));
    this.router.post("/update_stock", this.requireAuth, this.updateStock.bind(this));
    this.router.post("/update_price", this.requireAuth, this.updatePrice.bind(this));
  }

  public getCategory(_req: Request, res: Response): void {
    res.json({ error: "", message: "", request_id: rid(), response: { category_list: this.db.categories } });
  }

  public getAttributeTree(req: Request, res: Response): void {
    const ids = parseListParam(req.query.category_id_list).map(Number).filter(Boolean);
    const list = (ids.length ? ids : [100631]).map((cid) => ({ category_id: cid, attribute_tree: [] }));
    res.json({ error: "", message: "", request_id: rid(), response: { list } });
  }

  public getBrandList(_req: Request, res: Response): void {
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        brand_list: [
          { brand_id: 0, original_brand_name: "NoBrand", display_brand_name: "NoBrand" },
          { brand_id: 101, original_brand_name: "VitalCare", display_brand_name: "VitalCare" },
        ],
        has_next_page: false,
        next_offset: 0,
        is_mandatory: false,
        input_type: "DROP_DOWN",
      },
    });
  }

  public getItemLimit(_req: Request, res: Response): void {
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        price_limit: { min_limit: 1, max_limit: 1000000 },
        wholesale_price_threshold_percentage: { min_limit: 0, max_limit: 100 },
        stock_limit: { min_limit: 0, max_limit: 100000 },
        item_name_length_limit: { min_limit: 1, max_limit: 120 },
        item_description_length_limit: { min_limit: 20, max_limit: 3000 },
        item_Count_limit: { max_limit: 1000 },
      },
    });
  }

  public categoryRecommend(_req: Request, res: Response): void {
    res.json({ error: "", message: "", request_id: rid(), response: { category_id: [100631, 100630] } });
  }

  public getRecommendAttribute(_req: Request, res: Response): void {
    res.json({ error: "", message: "", request_id: rid(), response: { attribute_list: [] } });
  }

  public getItemList(req: Request, res: Response): void {
    const offset = parseInt(String(req.query.offset || "0"), 10) || 0;
    const pageSize = parseInt(String(req.query.page_size || "20"), 10) || 20;
    const statuses = parseListParam(req.query.item_status);
    let filtered = this.db.products;
    if (statuses.length) {
      filtered = this.db.products.filter((p) => statuses.includes(p.item_status));
    }
    const items = filtered.slice(offset, offset + pageSize).map((p) => ({
      item_id: p.item_id,
      item_status: p.item_status,
      update_time: p.update_time,
    }));
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        item: items,
        total_count: filtered.length,
        has_next_page: offset + pageSize < filtered.length,
        next_offset: offset + pageSize,
      },
    });
  }

  public getItemBaseInfo(req: Request, res: Response): void {
    const ids = parseListParam(req.query.item_id_list).map(Number);
    const items = this.db.products.filter((p) => ids.includes(p.item_id));
    res.json({ error: "", message: "", request_id: rid(), response: { item_list: items } });
  }

  public getBoostedList(_req: Request, res: Response): void {
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        item_list: this.db.boostedItems.map((id) => ({ item_id: id, cool_down_second: 14400 })),
      },
    });
  }

  public boostItem(req: Request, res: Response): void {
    const ids: number[] = Array.isArray(req.body?.item_id_list) ? req.body.item_id_list.map(Number) : [];
    for (const id of ids) {
      if (!this.db.boostedItems.includes(id)) this.db.boostedItems.push(id);
    }
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: { failure_list: [], success_list: { item_id_list: ids } },
    });
  }

  public addItem(req: Request, res: Response): void {
    const body = req.body || {};
    const newId = this.db.nextIds.item++;
    const now = ts();
    const stockVal = Array.isArray(body.seller_stock) && body.seller_stock[0] ? Number(body.seller_stock[0].stock ?? 10) : 10;
    const priceVal = Number(body.original_price ?? 100);
    const newItem: ProductItem = {
      item_id: newId,
      category_id: Number(body.category_id || 100631),
      item_name: String(body.item_name || `New Item ${newId}`),
      description: String(body.description || "Created via Shopee SDK"),
      item_sku: String(body.item_sku || `SKU-${newId}`),
      create_time: now,
      update_time: now,
      attribute_list: body.attribute_list || [],
      price_info: [{ currency: "PHP", original_price: priceVal, current_price: priceVal }],
      stock_info_v2: {
        summary_info: { total_reserved_stock: 0, total_available_stock: stockVal },
        seller_stock: [{ location_id: "PHZ", stock: stockVal }],
      },
      image: {
        image_url_list: ["https://cf.shopee.ph/file/mock_new_item"],
        image_id_list: body.image?.image_id_list || ["mock_new_item"],
      },
      weight: String(body.weight || "0.5"),
      dimension: body.dimension || { package_length: 10, package_width: 10, package_height: 10 },
      logistic_info: body.logistic_info || [{ logistic_id: 2001, logistic_name: "SPX Express", enabled: true, is_free: false }],
      pre_order: body.pre_order || { is_pre_order: false, days_to_ship: 2 },
      condition: body.condition || "NEW",
      size_chart: "",
      item_status: body.item_status || "NORMAL",
      has_model: false,
      promotion_id: 0,
      brand: body.brand || { brand_id: 0, original_brand_name: "NoBrand" },
    };
    this.db.products.push(newItem);
    this.storage.save();
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        item_id: newId,
        item_name: newItem.item_name,
        item_status: newItem.item_status,
        description: newItem.description,
        category_id: newItem.category_id,
        price_info: newItem.price_info[0],
        stock_info_v2: newItem.stock_info_v2,
        images: newItem.image,
        weight: Number(newItem.weight),
      },
    });
  }

  public updateItem(req: Request, res: Response): void {
    const body = req.body || {};
    const product = this.db.products.find((p) => p.item_id === Number(body.item_id));
    if (!product) {
      res.status(400).json({ error: "product.error_not_exist", message: "Item not found", request_id: rid() });
      return;
    }
    if (body.item_name) product.item_name = body.item_name;
    if (body.description) product.description = body.description;
    if (body.item_sku) product.item_sku = body.item_sku;
    if (body.item_status) product.item_status = body.item_status;
    product.update_time = ts();
    this.storage.save();
    res.json({ error: "", message: "", request_id: rid(), response: product });
  }

  public deleteItem(req: Request, res: Response): void {
    const itemId = Number(req.body?.item_id);
    const idx = this.db.products.findIndex((p) => p.item_id === itemId);
    if (idx !== -1) {
      this.db.products.splice(idx, 1);
      this.storage.save();
    }
    res.json({ error: "", message: "", request_id: rid(), response: {} });
  }

  public updateStock(req: Request, res: Response): void {
    const { item_id, stock_list } = req.body || {};
    const product = this.db.products.find((p) => p.item_id === Number(item_id));
    const newStock = stock_list?.[0]?.seller_stock?.[0]?.stock ?? 0;
    if (product) {
      product.stock_info_v2.summary_info.total_available_stock = newStock;
      product.stock_info_v2.seller_stock[0].stock = newStock;
      product.update_time = ts();
      this.storage.save();
    }
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        failure_list: [],
        success_list: [{ model_id: 0, location_id: "PHZ", stock: newStock }],
      },
    });
  }

  public updatePrice(req: Request, res: Response): void {
    const { item_id, price_list } = req.body || {};
    const product = this.db.products.find((p) => p.item_id === Number(item_id));
    const newPrice = price_list?.[0]?.original_price ?? product?.price_info[0]?.original_price ?? 100;
    if (product) {
      product.price_info[0].original_price = newPrice;
      product.price_info[0].current_price = newPrice;
      product.update_time = ts();
      this.storage.save();
    }
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        failure_list: [],
        success_list: [{ model_id: 0, original_price: newPrice }],
      },
    });
  }
}
