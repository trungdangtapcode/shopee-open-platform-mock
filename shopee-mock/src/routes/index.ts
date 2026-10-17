import { Express } from 'express';
import { authRouter } from './auth.routes';
import { consoleRouter } from './console.routes';
import { demoRouter } from './demo.routes';
import { logisticsRouter } from './logistics.routes';
import {
  bundleDealRouter,
  discountRouter,
  followPrizeRouter,
  shopCategoryRouter,
  voucherRouter,
} from './marketing.routes';
import { mediaRouter, mediaSpaceRouter } from './media.routes';
import { orderRouter } from './order.routes';
import { paymentRouter, returnsRouter } from './payment-returns.routes';
import { productRouter } from './product.routes';
import { publicRouter } from './public.routes';
import { notFoundHandler, schemaFallbackRouter } from './schema-fallback.routes';
import { shopRouter } from './shop.routes';

export function registerAllRoutes(app: Express): void {
  // 1. Web UIs, Demo, OAuth & Console routes
  app.use(consoleRouter);
  app.use(demoRouter);
  app.use(authRouter);

  // 2. Stateful Shopee Open Platform v2 Domain Routers
  app.use('/api/v2/public', publicRouter);
  app.use('/api/v2/shop', shopRouter);
  app.use('/api/v2/product', productRouter);
  app.use('/api/v2/order', orderRouter);
  app.use('/api/v2/logistics', logisticsRouter);
  app.use('/api/v2/payment', paymentRouter);
  app.use('/api/v2/returns', returnsRouter);
  app.use('/api/v2/voucher', voucherRouter);
  app.use('/api/v2/discount', discountRouter);
  app.use('/api/v2/bundle_deal', bundleDealRouter);
  app.use('/api/v2/follow_prize', followPrizeRouter);
  app.use('/api/v2/shop_category', shopCategoryRouter);
  app.use('/api/v2/media_space', mediaSpaceRouter);
  app.use('/api/v2/media', mediaRouter);

  // 3. Universal 455-Schema Fallback Engine + 404
  app.use(schemaFallbackRouter);
  app.use(notFoundHandler);
}
