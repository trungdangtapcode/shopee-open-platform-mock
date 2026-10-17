import { Request, Response } from "express";
import { ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { rid } from "../utils";
import { BaseManager } from "./base.manager";

export class MediaManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post("/upload_image", this.requireAuth, this.uploadImage.bind(this));
  }

  /**
   * Upload image via /api/v2/media/upload_image
   */
  public uploadImage(_req: Request, res: Response): void {
    const imgId = "mock_img_" + Math.random().toString(36).slice(2, 10);
    const url = `https://cf.shopee.ph/file/${imgId}`;
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        image_info: {
          image_id: imgId,
          image_url_list: [{ image_url_region: "PH", image_url: url }],
        },
        image_info_list: [
          {
            id: 0,
            error: "",
            message: "",
            image_info: {
              image_id: imgId,
              image_url_list: [{ image_url_region: "PH", image_url: url }],
            },
          },
        ],
        image_list: [{ image_id: imgId, image_url: url }],
      },
    });
  }
}
