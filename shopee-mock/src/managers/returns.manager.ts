import { Request, Response } from "express";
import { ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { rid } from "../utils";
import { BaseManager } from "./base.manager";

export class ReturnsManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get("/get_return_list", this.requireAuth, this.getReturnList.bind(this));
    this.router.get("/get_return_detail", this.requireAuth, this.getReturnDetail.bind(this));
  }

  /**
   * Get paginated return request list
   */
  public getReturnList(req: Request, res: Response): void {
    const pageNo = Math.max(1, parseInt(String(req.query.page_no || "1"), 10) || 1);
    const pageSize = Math.max(1, parseInt(String(req.query.page_size || "20"), 10) || 20);
    const start = (pageNo - 1) * pageSize;
    const page = this.db.returns.slice(start, start + pageSize);
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        return: page,
        more: start + pageSize < this.db.returns.length,
      },
    });
  }

  /**
   * Get single return detail by return_sn
   */
  public getReturnDetail(req: Request, res: Response): void {
    const returnSn = String(req.query.return_sn || "");
    const found = this.db.returns.find((r) => r.return_sn === returnSn);
    if (!found) {
      res.status(400).json({
        error: "returns.return_not_exist",
        message: `Return ${returnSn} does not exist.`,
        request_id: rid(),
      });
      return;
    }
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: found,
    });
  }
}
