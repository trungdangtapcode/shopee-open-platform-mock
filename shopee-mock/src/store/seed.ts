import { ts } from '../config/env';
import { Category, Order, ProductItem, ReturnRecord, ShopProfile } from './types';

export const DELIVERY_STEPS = [
  'Order Placed',
  'Picked Up',
  'In Transit',
  'Out for Delivery',
  'Delivered',
] as const;

export function createDefaultShop(): ShopProfile {
  return {
    shop_id: 123456,
    shop_name: 'Demo Shopee Store PH',
    region: 'PH',
    status: 'NORMAL',
    is_cb: false,
    auth_time: ts(),
    expire_time: ts() + 86400 * 30,
    description: 'Mock Shopee shop for Open Platform v2 & SDK integration.',
  };
}

export function createDefaultProducts(): ProductItem[] {
  return [
    { item_id: 10001, model_id: 0, name: '70% Isopropyl Alcohol 500ml', sku: 'FG-ALCO-70P', price: 95, category: 'Antiseptics' },
    { item_id: 10002, model_id: 0, name: 'Amoxicillin 500mg Capsule (Box/100)', sku: 'FG-AMOX-500', price: 620, category: 'Antibiotics' },
    { item_id: 10003, model_id: 0, name: 'Ascorbic Acid 500mg Tablet (Box/100)', sku: 'FG-ASCO-500', price: 210, category: 'Vitamins' },
    { item_id: 10004, model_id: 0, name: 'Cetirizine 10mg Tablet (Box/100)', sku: 'FG-CETI-010', price: 410, category: 'Allergy & Cold' },
    { item_id: 10005, model_id: 0, name: 'Losartan 50mg Tablet (Box/30)', sku: 'FG-LOSA-050', price: 340, category: 'Cardiovascular' },
    { item_id: 10006, model_id: 0, name: 'Metformin 500mg Tablet (Box/100)', sku: 'FG-METF-500', price: 295, category: 'Diabetes Care' },
    { item_id: 10007, model_id: 0, name: 'Paracetamol 500mg Tablet (Box/100)', sku: 'FG-PARA-500', price: 185, category: 'Pain Relief' },
    { item_id: 10008, model_id: 0, name: 'Povidone Iodine 10% Solution 120ml', sku: 'FG-POVI-10P', price: 88, category: 'Antiseptics' },
  ];
}

export function createDefaultOrders(): Order[] {
  return [
    {
      order_sn: 'SPX20260521001',
      order_status: 'READY_TO_SHIP',
      fulfillment_flag: 'fulfilled_by_local_seller',
      create_time: ts() - 3600,
      update_time: ts() - 60,
      buyer_user_id: 1001,
      buyer_username: 'juan_delacruz',
      shipping_carrier: 'SPX Express',
      currency: 'PHP',
      total_amount: 1620,
      estimated_shipping_fee: 0,
      actual_shipping_fee: 0,
      actual_shipping_fee_confirmed: false,
      tracking_no: '',
      package_list: [{ package_number: '', logistics_status: 'LOGISTICS_REQUEST_CREATED', shipping_carrier: 'SPX Express', item_list: [] }],
      recipient_address: {
        name: 'Juan Dela Cruz',
        phone: '+639171234567',
        full_address: '123 Rizal Street, Barangay San Antonio, Makati, Metro Manila, 1200, PH',
        city: 'Makati',
        state: 'Metro Manila',
        region: 'PH',
        zipcode: '1200',
      },
      item_list: [
        { item_id: 10007, model_id: 0, item_name: 'Paracetamol 500mg Tablet (Box/100)', item_sku: 'FG-PARA-500', model_sku: 'FG-PARA-500', model_quantity_purchased: 2, model_original_price: 185, model_discounted_price: 185 },
        { item_id: 10002, model_id: 0, item_name: 'Amoxicillin 500mg Capsule (Box/100)', item_sku: 'FG-AMOX-500', model_sku: 'FG-AMOX-500', model_quantity_purchased: 1, model_original_price: 620, model_discounted_price: 620 },
        { item_id: 10003, model_id: 0, item_name: 'Ascorbic Acid 500mg Tablet (Box/100)', item_sku: 'FG-ASCO-500', model_sku: 'FG-ASCO-500', model_quantity_purchased: 3, model_original_price: 210, model_discounted_price: 210 },
      ],
    },
    {
      order_sn: 'SPX20260521002',
      order_status: 'READY_TO_SHIP',
      fulfillment_flag: 'fulfilled_by_local_seller',
      create_time: ts() - 86400,
      update_time: ts() - 60,
      buyer_user_id: 1002,
      buyer_username: 'maria_santos',
      shipping_carrier: 'SPX Express',
      currency: 'PHP',
      total_amount: 1160,
      estimated_shipping_fee: 0,
      actual_shipping_fee: 0,
      actual_shipping_fee_confirmed: false,
      tracking_no: '',
      package_list: [{ package_number: '', logistics_status: 'LOGISTICS_REQUEST_CREATED', shipping_carrier: 'SPX Express', item_list: [] }],
      recipient_address: {
        name: 'Maria Santos',
        phone: '+639289876543',
        full_address: '456 Bonifacio Avenue, Barangay Poblacion, Cebu City, Cebu, 6000, PH',
        city: 'Cebu City',
        state: 'Cebu',
        region: 'PH',
        zipcode: '6000',
      },
      item_list: [
        { item_id: 10005, model_id: 0, item_name: 'Losartan 50mg Tablet (Box/30)', item_sku: 'FG-LOSA-050', model_sku: 'FG-LOSA-050', model_quantity_purchased: 1, model_original_price: 340, model_discounted_price: 340 },
        { item_id: 10004, model_id: 0, item_name: 'Cetirizine 10mg Tablet (Box/100)', item_sku: 'FG-CETI-010', model_sku: 'FG-CETI-010', model_quantity_purchased: 2, model_original_price: 410, model_discounted_price: 410 },
      ],
    },
    {
      order_sn: 'SPX20260521003',
      order_status: 'READY_TO_SHIP',
      fulfillment_flag: 'fulfilled_by_local_seller',
      create_time: ts() - 7200,
      update_time: ts() - 60,
      buyer_user_id: 1003,
      buyer_username: 'jose_reyes',
      shipping_carrier: 'J&T Express',
      currency: 'PHP',
      total_amount: 837,
      estimated_shipping_fee: 0,
      actual_shipping_fee: 0,
      actual_shipping_fee_confirmed: false,
      tracking_no: '',
      package_list: [{ package_number: '', logistics_status: 'LOGISTICS_REQUEST_CREATED', shipping_carrier: 'J&T Express', item_list: [] }],
      recipient_address: {
        name: 'Jose Reyes',
        phone: '+639351112222',
        full_address: '789 Quezon Boulevard, Barangay Malate, Davao City, Davao del Sur, 8000, PH',
        city: 'Davao City',
        state: 'Davao del Sur',
        region: 'PH',
        zipcode: '8000',
      },
      item_list: [
        { item_id: 10006, model_id: 0, item_name: 'Metformin 500mg Tablet (Box/100)', item_sku: 'FG-METF-500', model_sku: 'FG-METF-500', model_quantity_purchased: 1, model_original_price: 295, model_discounted_price: 295 },
        { item_id: 10001, model_id: 0, item_name: '70% Isopropyl Alcohol 500ml', item_sku: 'FG-ALCO-70P', model_sku: 'FG-ALCO-70P', model_quantity_purchased: 2, model_original_price: 95, model_discounted_price: 95 },
        { item_id: 10008, model_id: 0, item_name: 'Povidone Iodine 10% Solution 120ml', item_sku: 'FG-POVI-10P', model_sku: 'FG-POVI-10P', model_quantity_purchased: 4, model_original_price: 88, model_discounted_price: 88 },
      ],
    },
  ];
}

export function createDefaultCategories(): Category[] {
  return [
    { category_id: 100001, parent_category_id: 0, original_category_name: 'Health & Personal Care', display_category_name: 'Health & Personal Care', has_children: true },
    { category_id: 100002, parent_category_id: 100001, original_category_name: 'OTC Medicine & Supplements', display_category_name: 'OTC Medicine & Supplements', has_children: false },
    { category_id: 100003, parent_category_id: 0, original_category_name: 'Apparel & Accessories', display_category_name: 'Apparel & Accessories', has_children: false },
  ];
}

export function createDefaultReturns(): ReturnRecord[] {
  return [
    {
      return_sn: 'RET20260521001',
      order_sn: 'SPX20260521001',
      reason: 'DIFFERENT_DESCRIPTION',
      text_reason: 'Item packaging slightly dented',
      return_price: 185,
      currency: 'PHP',
      create_time: ts() - 3600,
      update_time: ts() - 1800,
      status: 'REQUESTED',
      amount_before_discount: 185,
      user: { username: 'juan_delacruz', email: 'juan@example.com', portrait: '' },
      item: [
        {
          model_id: 0,
          name: 'Paracetamol 500mg Tablet (Box/100)',
          images: [],
          amount: 1,
          item_price: 185,
          is_add_on_deal: false,
          is_main_item: true,
          item_id: 10007,
          item_sku: 'FG-PARA-500',
          variation_sku: 'FG-PARA-500',
        },
      ],
    },
  ];
}
