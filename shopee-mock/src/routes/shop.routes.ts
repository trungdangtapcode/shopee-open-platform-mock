import { Request, Response, Router } from 'express';
import { rid } from '../config/env';
import { requireAuth } from '../middleware/signature';
import { DB, saveState } from '../store/database';

export const shopRouter = Router();

shopRouter.get('/get_shop_info', requireAuth, (_req: Request, res: Response) => {
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    ...DB.shop,
    response: { ...DB.shop },
  });
});

shopRouter.get('/get_profile', requireAuth, (_req: Request, res: Response) => {
  const profile = {
    shop_logo: DB.shop.shop_logo || 'https://placehold.co/200x200/EE4D2D/fff?text=Shop',
    description: DB.shop.description || '',
    shop_name: DB.shop.shop_name,
  };
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: profile,
  });
});

shopRouter.post('/update_profile', requireAuth, (req: Request, res: Response) => {
  const { shop_name, description, shop_logo } = req.body || {};
  if (shop_name && String(shop_name).length > 200) {
    res.status(400).json({
      error: 'shop.error_param',
      message: 'shop_name is too long',
      request_id: rid(),
    });
    return;
  }
  if (shop_name !== undefined) DB.shop.shop_name = shop_name;
  if (description !== undefined) DB.shop.description = description;
  if (shop_logo !== undefined) DB.shop.shop_logo = shop_logo;
  saveState();
  res.json({
    error: '',
    message: '',
    request_id: rid(),
    response: {
      shop_logo: DB.shop.shop_logo || 'https://placehold.co/200x200/EE4D2D/fff?text=Shop',
      description: DB.shop.description,
      shop_name: DB.shop.shop_name,
    },
  });
});
