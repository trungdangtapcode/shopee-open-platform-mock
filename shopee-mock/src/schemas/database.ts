import {
  BundleDealRecord,
  DiscountRecord,
  FollowPrizeRecord,
  ReturnRecord,
  ShopCategoryRecord,
  VideoUploadRecord,
  VoucherRecord,
} from "./marketing";
import { Order } from "./order";
import { ProductItem } from "./product";
import { CategoryItem, ShopProfile } from "./shop";

export interface MockDatabase {
  shop: ShopProfile;
  products: ProductItem[];
  orders: Order[];
  trackingNumbers: Record<string, string>;
  labelStatus: Record<string, string>;
  deliveryStatus: Record<string, number>;
  webhookUrls: string[];
  categories: CategoryItem[];
  boostedItems: number[];
  vouchers: VoucherRecord[];
  discounts: DiscountRecord[];
  bundleDeals: BundleDealRecord[];
  followPrizes: FollowPrizeRecord[];
  shopCategories: ShopCategoryRecord[];
  returns: ReturnRecord[];
  videoUploads: Record<string, VideoUploadRecord>;
  shippingJobs: Record<string, { order_list: unknown[]; created_at: number }>;
  nextIds: {
    item: number;
    voucher: number;
    discount: number;
    bundleDeal: number;
    followPrize: number;
    shopCategory: number;
  };
}
