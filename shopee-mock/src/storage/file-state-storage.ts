import fs from "fs";
import { MockDatabase, ShopeeMockConfig } from "../schemas";
import { createSeedDatabase } from "./seed";
import { StateStorage } from "./state-storage.interface";

export class FileStateStorage implements StateStorage {
  public readonly db: MockDatabase;
  private orderCounter = 2;

  constructor(private readonly config: ShopeeMockConfig) {
    this.db = createSeedDatabase(this.config.shopId);
  }

  public load(): void {
    try {
      if (!fs.existsSync(this.config.stateFile)) return;
      const saved = JSON.parse(fs.readFileSync(this.config.stateFile, "utf8"));
      if (saved.orders) this.db.orders = saved.orders;
      if (saved.products) this.db.products = saved.products;
      if (saved.trackingNumbers) this.db.trackingNumbers = saved.trackingNumbers;
      if (saved.labelStatus) this.db.labelStatus = saved.labelStatus;
      if (saved.deliveryStatus) this.db.deliveryStatus = saved.deliveryStatus;
      if (saved.orderCounter) this.orderCounter = saved.orderCounter;
      if (saved.vouchers) this.db.vouchers = saved.vouchers;
      if (saved.discounts) this.db.discounts = saved.discounts;
      if (saved.bundleDeals) this.db.bundleDeals = saved.bundleDeals;
      if (saved.followPrizes) this.db.followPrizes = saved.followPrizes;
      if (saved.shopCategories) this.db.shopCategories = saved.shopCategories;
      if (saved.nextIds) Object.assign(this.db.nextIds, saved.nextIds);

      for (const order of this.db.orders) {
        if (this.db.trackingNumbers[order.order_sn] && !order.tracking_no) {
          order.tracking_no = this.db.trackingNumbers[order.order_sn];
        }
      }
    } catch (_) {
      // Ignore corrupt state file and start with seed data
    }
  }

  public save(): void {
    try {
      fs.writeFileSync(
        this.config.stateFile,
        JSON.stringify(
          {
            orders: this.db.orders,
            products: this.db.products,
            trackingNumbers: this.db.trackingNumbers,
            labelStatus: this.db.labelStatus,
            deliveryStatus: this.db.deliveryStatus,
            orderCounter: this.orderCounter,
            vouchers: this.db.vouchers,
            discounts: this.db.discounts,
            bundleDeals: this.db.bundleDeals,
            followPrizes: this.db.followPrizes,
            shopCategories: this.db.shopCategories,
            nextIds: this.db.nextIds,
          },
          null,
          2
        )
      );
    } catch (_) {
      // Ignore file write errors
    }
  }

  public reset(): void {
    const fresh = createSeedDatabase(this.config.shopId);
    Object.assign(this.db, fresh);
    this.orderCounter = 2;
    this.save();
  }

  public nextOrderCounter(): number {
    const current = this.orderCounter;
    this.orderCounter += 1;
    return current;
  }
}
