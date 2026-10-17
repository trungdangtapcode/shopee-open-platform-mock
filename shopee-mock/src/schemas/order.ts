export interface RecipientAddress {
  name: string;
  phone: string;
  town: string;
  district: string;
  city: string;
  state: string;
  region: string;
  zipcode: string;
  full_address: string;
}

export interface OrderItem {
  item_id: number;
  item_name: string;
  item_sku: string;
  model_id: number;
  model_name: string;
  model_sku: string;
  model_quantity_purchased: number;
  model_original_price: number;
  model_discounted_price: number;
  wholesale: boolean;
  weight: number;
  add_on_deal: boolean;
  main_item: boolean;
  add_on_deal_id: number;
  promotion_type: string;
  promotion_id: number;
  order_item_id: number;
  promotion_group_id: number;
  image_info: {
    image_url: string;
  };
}

export interface OrderPackageItem {
  item_id: number;
  model_id: number;
  model_quantity: number;
}

export interface OrderPackage {
  package_number: string;
  logistics_status: string;
  shipping_carrier: string;
  item_list: OrderPackageItem[];
}

export interface Order {
  order_sn: string;
  region: string;
  currency: string;
  cod: boolean;
  total_amount: number;
  order_status: string;
  shipping_carrier: string;
  payment_method: string;
  estimated_shipping_fee: number;
  message_to_seller: string;
  create_time: number;
  update_time: number;
  days_to_ship: number;
  ship_by_date: number;
  buyer_user_id: number;
  buyer_username: string;
  recipient_address: RecipientAddress;
  actual_shipping_fee: number;
  goods_to_declare: boolean;
  note: string;
  note_update_time: number;
  item_list: OrderItem[];
  pay_time: number;
  dropshipper: string;
  dropshipper_phone: string;
  split_up: boolean;
  buyer_cancel_reason: string;
  cancel_by: string;
  cancel_reason: string;
  actual_shipping_fee_confirmed: boolean;
  buyer_cpf_id: string;
  fulfillment_flag: string;
  pickup_done_time: number;
  package_list: OrderPackage[];
  invoice_data: unknown;
  checkout_shipping_carrier: string;
  reverse_shipping_fee: number;
  order_chargeable_weight_gram: number;
  edt: unknown;
  prescription_images: unknown[];
  prescription_check_status: unknown;
  tracking_no: string;
}

export interface DeliveryStep {
  key: string;
  label: string;
  icon: string;
  desc: string;
}
