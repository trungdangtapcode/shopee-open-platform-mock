export interface ProductImage {
  image_url_list: string[];
  image_id_list: string[];
}

export interface ProductDimension {
  package_length: number;
  package_width: number;
  package_height: number;
}

export interface ProductLogisticInfo {
  logistic_id: number;
  logistic_name: string;
  enabled: boolean;
  is_free: boolean;
}

export interface ProductPreOrder {
  is_pre_order: boolean;
  days_to_ship: number;
}

export interface ProductPriceInfo {
  currency: string;
  original_price: number;
  current_price: number;
}

export interface ProductStockInfoV2 {
  summary_info: {
    total_reserved_stock: number;
    total_available_stock: number;
  };
  seller_stock: Array<{
    location_id: string;
    stock: number;
  }>;
}

export interface ProductItem {
  item_id: number;
  category_id: number;
  item_name: string;
  description: string;
  item_sku: string;
  create_time: number;
  update_time: number;
  attribute_list: unknown[];
  price_info: ProductPriceInfo[];
  stock_info_v2: ProductStockInfoV2;
  image: ProductImage;
  weight: string;
  dimension: ProductDimension;
  logistic_info: ProductLogisticInfo[];
  pre_order: ProductPreOrder;
  condition: string;
  size_chart: string;
  item_status: string;
  has_model: boolean;
  promotion_id: number;
  brand: {
    brand_id: number;
    original_brand_name: string;
  };
}
