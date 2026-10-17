import fs from 'fs';
import { CONFIG } from '../config/env';
import {
  createDefaultCategories,
  createDefaultOrders,
  createDefaultProducts,
  createDefaultReturns,
  createDefaultShop,
} from './seed';
import { MockDatabase } from './types';

let orderCounter = 4;

export const DB: MockDatabase = {
  shop: createDefaultShop(),
  products: createDefaultProducts(),
  syncedProducts: {},
  orders: createDefaultOrders(),
  labelStatus: {},
  trackingNumbers: {},
  deliveryStatus: {},
  categories: createDefaultCategories(),
  vouchers: [],
  discounts: [],
  bundleDeals: [],
  followPrizes: [],
  shopCategories: [],
  returns: createDefaultReturns(),
  videoUploads: {},
  boostedItems: [],
  apiLogs: [],
};

export function nextOrderCounter(): number {
  orderCounter += 1;
  return orderCounter;
}

export function saveState(): void {
  try {
    fs.writeFileSync(
      CONFIG.stateFile,
      JSON.stringify(
        {
          orders: DB.orders,
          trackingNumbers: DB.trackingNumbers,
          labelStatus: DB.labelStatus,
          deliveryStatus: DB.deliveryStatus,
          syncedProducts: DB.syncedProducts,
          orderCounter,
        },
        null,
        2
      )
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[STATE] Save failed:', msg);
  }
}

export function loadState(): void {
  try {
    if (!fs.existsSync(CONFIG.stateFile)) {
      console.log('[STATE] No saved state found — starting fresh');
      return;
    }
    const saved = JSON.parse(fs.readFileSync(CONFIG.stateFile, 'utf8'));
    if (saved.orders) DB.orders = saved.orders;
    if (saved.trackingNumbers) DB.trackingNumbers = saved.trackingNumbers;
    if (saved.labelStatus) DB.labelStatus = saved.labelStatus;
    if (saved.deliveryStatus) DB.deliveryStatus = saved.deliveryStatus;
    if (saved.syncedProducts) DB.syncedProducts = saved.syncedProducts;
    if (saved.orderCounter) orderCounter = saved.orderCounter;
    console.log(
      `[STATE] Restored from ${CONFIG.stateFile} — ${DB.orders.length} orders, ${Object.keys(DB.trackingNumbers).length} tracking numbers`
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[STATE] Load failed:', msg);
  }
}

export function resetState(): void {
  DB.shop = createDefaultShop();
  DB.products = createDefaultProducts();
  DB.orders = createDefaultOrders();
  DB.trackingNumbers = {};
  DB.labelStatus = {};
  DB.deliveryStatus = {};
  DB.syncedProducts = {};
  DB.vouchers = [];
  DB.discounts = [];
  DB.bundleDeals = [];
  DB.followPrizes = [];
  DB.shopCategories = [];
  orderCounter = 4;
  saveState();
}
