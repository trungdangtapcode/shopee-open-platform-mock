import { Request, Response } from "express";
import { ShopCategoryRecord, ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { rid } from "../utils";
import { BaseManager } from "./base.manager";

export class ShopCategoryManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post("/add_shop_category", this.requireAuth, this.addShopCategory.bind(this));
    this.router.get("/get_shop_category_list", this.requireAuth, this.getShopCategoryList.bind(this));
    this.router.post("/update_shop_category", this.requireAuth, this.updateShopCategory.bind(this));
    this.router.post("/delete_shop_category", this.requireAuth, this.deleteShopCategory.bind(this));
  }

  public addShopCategory(req: Request, res: Response): void {
    const body = req.body || {};
    const shop_category_id = this.db.nextIds.shopCategory++;
    const sc: ShopCategoryRecord = {
      shop_category_id,
      name: String(body.name || "Mock Category"),
      sort_weight: Number(body.sort_weight ?? 1),
      status: 1,
      item_list: [],
    };
    this.db.shopCategories.push(sc);
    this.storage.save();
    res.json({ error: "", message: "", request_id: rid(), response: { shop_category_id } });
  }

  public getShopCategoryList(_req: Request, res: Response): void {
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        shop_categorys: this.db.shopCategories,
        more: false,
        total_count: this.db.shopCategories.length,
      },
    });
  }

  public updateShopCategory(req: Request, res: Response): void {
    const body = req.body || {};
    const sc = this.db.shopCategories.find((x) => x.shop_category_id === Number(body.shop_category_id));
    if (sc) {
      if (body.name) sc.name = body.name;
      if (body.sort_weight !== undefined) sc.sort_weight = Number(body.sort_weight);
      if (body.status !== undefined) sc.status = Number(body.status);
      this.storage.save();
    }
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: sc || { shop_category_id: Number(body.shop_category_id) },
    });
  }

  public deleteShopCategory(req: Request, res: Response): void {
    const id = Number(req.body?.shop_category_id);
    const idx = this.db.shopCategories.findIndex((x) => x.shop_category_id === id);
    if (idx !== -1) {
      this.db.shopCategories.splice(idx, 1);
      this.storage.save();
    }
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: { shop_category_id: id, msg: "success" },
    });
  }
}
