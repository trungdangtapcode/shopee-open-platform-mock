import { Request, Response } from "express";
import { ShopeeMockConfig } from "../schemas";
import { StateStorage } from "../storage";
import { rid, ts } from "../utils";
import { BaseManager } from "./base.manager";

export class MediaSpaceManager extends BaseManager {
  constructor(config: ShopeeMockConfig, storage: StateStorage) {
    super(config, storage);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post("/upload_image", this.requireAuth, this.uploadImage.bind(this));
    this.router.post("/init_video_upload", this.requireAuth, this.initVideoUpload.bind(this));
    this.router.post("/upload_video_part", this.requireAuth, this.uploadVideoPart.bind(this));
    this.router.post("/complete_video_upload", this.requireAuth, this.completeVideoUpload.bind(this));
    this.router.get("/get_video_upload_result", this.requireAuth, this.getVideoUploadResult.bind(this));
    this.router.post("/cancel_video_upload", this.requireAuth, this.cancelVideoUpload.bind(this));
  }

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

  public initVideoUpload(_req: Request, res: Response): void {
    const video_upload_id = "vid_" + Math.random().toString(36).slice(2, 12);
    this.db.videoUploads[video_upload_id] = { status: "INITIATED", created_at: ts() };
    res.json({ error: "", message: "", request_id: rid(), response: { video_upload_id } });
  }

  public uploadVideoPart(_req: Request, res: Response): void {
    res.json({ error: "", message: "", request_id: rid(), response: {} });
  }

  public completeVideoUpload(req: Request, res: Response): void {
    const videoUploadId = String(req.body?.video_upload_id || "");
    if (videoUploadId && this.db.videoUploads[videoUploadId]) {
      this.db.videoUploads[videoUploadId].status = "SUCCEEDED";
    }
    res.json({ error: "", message: "", request_id: rid(), response: {} });
  }

  public getVideoUploadResult(req: Request, res: Response): void {
    const videoUploadId = String(req.query.video_upload_id || "");
    const upload = this.db.videoUploads[videoUploadId] || { status: "SUCCEEDED" };
    res.json({
      error: "",
      message: "",
      request_id: rid(),
      response: {
        status: upload.status,
        video_info: {
          video_url_list: [{ video_url_region: "PH", video_url: `https://cv.shopee.ph/file/${videoUploadId}.mp4` }],
          thumbnail_url_list: [
            { image_url_region: "PH", image_url: `https://cf.shopee.ph/file/${videoUploadId}_thumb.jpg` },
          ],
          duration: 10,
        },
      },
    });
  }

  public cancelVideoUpload(req: Request, res: Response): void {
    const videoUploadId = String(req.body?.video_upload_id || "");
    if (videoUploadId) delete this.db.videoUploads[videoUploadId];
    res.json({ error: "", message: "", request_id: rid(), response: {} });
  }
}
