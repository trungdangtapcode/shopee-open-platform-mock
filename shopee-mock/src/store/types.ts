export interface ShopProfile {
  shop_id: number;
  shop_name: string;
  region: string;
  status: string;
  is_cb: boolean;
  auth_time: number;
  expire_time: number;
  description: string;
  shop_logo?: string;
}

export interface ProductItem {
  item_id: number;
  model_id: number;
  name: string;
  sku: string;
  price: number;
  category: string | number;
  description?: string;
  item_status?: string;
  weight?: number;
  stock?: number;
}

export interface SyncedProduct {
  item_id: number;
  sku: string;
  name: string;
  stock: number;
  source: string;
  last_sync: string;
}

export interface RecipientAddress {
  name: string;
  phone: string;
  full_address: string;
  city: string;
  state: string;
  region: string;
  zipcode: string;
}

export interface OrderItem {
  item_id: number;
  model_id: number;
  item_name: string;
  item_sku: string;
  model_sku: string;
  model_quantity_purchased: number;
  model_original_price: number;
  model_discounted_price: number;
}

export interface OrderPackage {
  package_number: string;
  logistics_status: string;
  shipping_carrier: string;
  item_list: unknown[];
}

export interface Order {
  order_sn: string;
  order_status: string;
  fulfillment_flag: string;
  create_time: number;
  update_time: number;
  buyer_user_id: number;
  buyer_username: string;
  shipping_carrier: string;
  currency: string;
  total_amount: number;
  estimated_shipping_fee: number;
  actual_shipping_fee: number;
  actual_shipping_fee_confirmed: boolean;
  tracking_no: string;
  package_list: OrderPackage[];
  recipient_address: RecipientAddress;
  item_list: OrderItem[];
}

export interface Category {
  category_id: number;
  parent_category_id: number;
  original_category_name: string;
  display_category_name: string;
  has_children: boolean;
}

export interface Voucher {
  voucher_id: number;
  voucher_code: string;
  voucher_name: string;
  voucher_type: number;
  reward_type: number;
  usage_quantity: number;
  current_usage: number;
  start_time: number;
  end_time: number;
  is_admin: boolean;
  voucher_purpose: number;
  min_basket_price: number;
  discount_amount: number;
  percentage?: number;
  max_price?: number;
  status: string;
}

export interface Discount {
  discount_id: number;
  discount_name: string;
  start_time: number;
  end_time: number;
  status: string;
  item_list: unknown[];
}

export interface BundleDeal {
  bundle_deal_id: number;
  name: string;
  start_time: number;
  end_time: number;
  time_status: number;
  bundle_deal_rule: Record<string, unknown>;
  purchase_limit: number;
}

export interface FollowPrize {
  campaign_id: number;
  campaign_status: string;
  follow_prize_name: string;
  start_time: number;
  end_time: number;
  usage_quantity: number;
  min_spend: number;
  reward_type: number;
  discount_amount?: number;
  percentage?: number;
  max_price?: number;
}

export interface ShopCategory {
  shop_category_id: number;
  name: string;
  status: number;
  sort_weight: number;
}

export interface ReturnRecord {
  return_sn: string;
  order_sn: string;
  reason: string;
  text_reason: string;
  return_price: number;
  currency: string;
  create_time: number;
  update_time: number;
  status: string;
  amount_before_discount: number;
  user: { username: string; email: string; portrait: string };
  item: Array<Record<string, unknown>>;
}

export interface ApiLogEntry {
  id: string;
  time: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  query: Record<string, unknown>;
  body?: unknown;
}

export interface MockDatabase {
  shop: ShopProfile;
  products: ProductItem[];
  syncedProducts: Record<number, SyncedProduct>;
  orders: Order[];
  labelStatus: Record<string, string>;
  trackingNumbers: Record<string, string>;
  deliveryStatus: Record<string, number>;
  categories: Category[];
  vouchers: Voucher[];
  discounts: Discount[];
  bundleDeals: BundleDeal[];
  followPrizes: FollowPrize[];
  shopCategories: ShopCategory[];
  returns: ReturnRecord[];
  videoUploads: Record<string, { status: string; created_at: number }>;
  boostedItems: number[];
  apiLogs: ApiLogEntry[];
}
