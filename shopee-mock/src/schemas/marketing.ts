export interface VoucherRecord {
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
  discount_amount: number;
  percentage: number;
  max_price: number;
  min_basket_price: number;
  display_channel_list: number[];
  display_start_time: number;
  cmt_voucher_status: number;
}

export interface DiscountRecord {
  discount_id: number;
  discount_name: string;
  start_time: number;
  end_time: number;
  status: string;
  item_list: unknown[];
}

export interface BundleDealRecord {
  bundle_deal_id: number;
  name: string;
  start_time: number;
  end_time: number;
  time_status: number;
  bundle_deal_rule: Record<string, unknown>;
  purchase_limit: number;
  item_list: unknown[];
}

export interface FollowPrizeRecord {
  campaign_id: number;
  campaign_status: string;
  follow_prize_name: string;
  start_time: number;
  end_time: number;
  usage_quantity: number;
  min_spend: number;
  reward_type: number;
  discount_amount: number;
  percentage: number;
  max_price: number;
}

export interface ShopCategoryRecord {
  shop_category_id: number;
  name: string;
  sort_weight: number;
  status: number;
  item_list: number[];
}

export interface ReturnRecord {
  return_sn: string;
  order_sn: string;
  reason: string;
  text_reason: string;
  return_BigDecimal_amount: number;
  refund_amount: number;
  currency: string;
  create_time: number;
  update_time: number;
  status: string;
  negotiation_status: string;
  seller_proof_status: string;
  seller_compensation_status: string;
  user: {
    username: string;
    email: string;
    portrait: string;
  };
  item: Array<{
    model_id: number;
    name: string;
    images: string[];
    amount: number;
    item_price: number;
    is_add_on_deal: boolean;
    is_main_item: boolean;
    item_id: number;
    item_sku: string;
    variation_sku: string;
  }>;
}

export interface VideoUploadRecord {
  status: string;
  created_at: number;
}
