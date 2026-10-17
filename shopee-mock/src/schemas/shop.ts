export interface ShopProfile {
  shop_id: number;
  shop_name: string;
  region: string;
  status: string;
  shop_logo: string;
  description: string;
  is_cb: boolean;
  is_cnsc: boolean;
  auth_time: number;
  expire_time: number;
}

export interface CategoryItem {
  category_id: number;
  parent_category_id: number;
  original_category_name: string;
  display_category_name: string;
  has_children: boolean;
}
