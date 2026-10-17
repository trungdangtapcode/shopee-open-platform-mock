import { Request, Response, Router } from 'express';
import { rid, ts } from '../config/env';
import { requireAuth } from '../middleware/signature';
import { DB } from '../store/database';

export const mediaSpaceRouter = Router();
export const mediaRouter = Router();

function handleUploadImage(_req: Request, res: Response): void {
  const imgId = 'mock_img_' + Math.random().toString(36).slice(2, 10);
  const url = `https://cf.shopee.ph/file/${imgId}`;
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      image_info: {
        image_id: imgId,
        image_url_list: [{ image_url_region: 'PH', image_url: url }],
      },
      image_info_list: [
        {
          id: 0,
          error: '',
          message: '',
          image_info: {
            image_id: imgId,
            image_url_list: [{ image_url_region: 'PH', image_url: url }],
          },
        },
      ],
      image_list: [
        {
          image_id: imgId,
          image_url: url,
        },
      ],
    },
  });
}

mediaSpaceRouter.post('/upload_image', requireAuth, handleUploadImage);
mediaRouter.post('/upload_image', requireAuth, handleUploadImage);

mediaSpaceRouter.post('/init_video_upload', requireAuth, (_req: Request, res: Response) => {
  const video_upload_id = 'vid_' + Math.random().toString(36).slice(2, 12);
  DB.videoUploads[video_upload_id] = { status: 'INITIATED', created_at: ts() };
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: { video_upload_id },
  });
});

mediaSpaceRouter.post('/upload_video_part', requireAuth, (_req: Request, res: Response) => {
  res.json({ error: '', message: '', request_id: rid(), response: {} });
});

mediaSpaceRouter.post('/complete_video_upload', requireAuth, (req: Request, res: Response) => {
  const videoUploadId = String(req.body?.video_upload_id || '');
  if (videoUploadId && DB.videoUploads[videoUploadId]) {
    DB.videoUploads[videoUploadId].status = 'SUCCEEDED';
  }
  res.json({ error: '', message: '', request_id: rid(), response: {} });
});

mediaSpaceRouter.get('/get_video_upload_result', requireAuth, (req: Request, res: Response) => {
  const videoUploadId = String(req.query.video_upload_id || '');
  const upload = DB.videoUploads[videoUploadId] || { status: 'SUCCEEDED' };
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      status: upload.status,
      video_info: {
        video_url_list: [
          { video_url_region: 'PH', video_url: `https://cv.shopee.ph/file/${videoUploadId}.mp4` },
        ],
        thumbnail_url_list: [
          {
            image_url_region: 'PH',
            image_url: `https://cf.shopee.ph/file/${videoUploadId}_thumb.jpg`,
          },
        ],
        duration: 10,
      },
    },
  });
});

mediaSpaceRouter.post('/cancel_video_upload', requireAuth, (req: Request, res: Response) => {
  const videoUploadId = String(req.body?.video_upload_id || '');
  if (videoUploadId) delete DB.videoUploads[videoUploadId];
  res.json({ error: '', message: '', request_id: rid(), response: {} });
});
