import express, { Express } from "express";
import { Server } from "http";
import {
  AuthManager,
  BundleDealManager,
  ConsoleManager,
  DemoManager,
  DiscountManager,
  FollowPrizeManager,
  LogisticsManager,
  MediaManager,
  MediaSpaceManager,
  OrderManager,
  PaymentManager,
  ProductManager,
  PublicManager,
  ReturnsManager,
  SchemaFallbackManager,
  ShopCategoryManager,
  ShopManager,
  VoucherManager,
} from "./managers";
import { DEFAULT_CONFIG, ShopeeMockConfig } from "./schemas";
import { FileStateStorage, StateStorage } from "./storage";
import { RequestLogger, SchemaRegistry } from "./utils";

export class ShopeeMockServer {
  public readonly config: ShopeeMockConfig;
  public readonly storage: StateStorage;
  public readonly schemaRegistry: SchemaRegistry;
  public readonly requestLogger: RequestLogger;
  public readonly app: Express;

  public readonly auth: AuthManager;
  public readonly public: PublicManager;
  public readonly shop: ShopManager;
  public readonly product: ProductManager;
  public readonly order: OrderManager;
  public readonly logistics: LogisticsManager;
  public readonly payment: PaymentManager;
  public readonly returns: ReturnsManager;
  public readonly voucher: VoucherManager;
  public readonly discount: DiscountManager;
  public readonly bundleDeal: BundleDealManager;
  public readonly followPrize: FollowPrizeManager;
  public readonly shopCategory: ShopCategoryManager;
  public readonly media: MediaManager;
  public readonly mediaSpace: MediaSpaceManager;
  public readonly demo: DemoManager;
  public readonly console: ConsoleManager;
  public readonly schemaFallback: SchemaFallbackManager;

  constructor(config?: Partial<ShopeeMockConfig>, storage?: StateStorage) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storage = storage || new FileStateStorage(this.config);
    this.storage.load();

    this.schemaRegistry = new SchemaRegistry(this.config.schemasDir);
    this.requestLogger = new RequestLogger();

    this.auth = new AuthManager(this.config, this.storage);
    this.public = new PublicManager(this.config, this.storage);
    this.shop = new ShopManager(this.config, this.storage);
    this.product = new ProductManager(this.config, this.storage);
    this.order = new OrderManager(this.config, this.storage);
    this.logistics = new LogisticsManager(this.config, this.storage);
    this.payment = new PaymentManager(this.config, this.storage);
    this.returns = new ReturnsManager(this.config, this.storage);
    this.voucher = new VoucherManager(this.config, this.storage);
    this.discount = new DiscountManager(this.config, this.storage);
    this.bundleDeal = new BundleDealManager(this.config, this.storage);
    this.followPrize = new FollowPrizeManager(this.config, this.storage);
    this.shopCategory = new ShopCategoryManager(this.config, this.storage);
    this.media = new MediaManager(this.config, this.storage);
    this.mediaSpace = new MediaSpaceManager(this.config, this.storage);
    this.demo = new DemoManager(this.config, this.storage);
    this.console = new ConsoleManager(this.config, this.storage, this.schemaRegistry, this.requestLogger);
    this.schemaFallback = new SchemaFallbackManager(this.config, this.storage, this.schemaRegistry);

    this.app = this.createExpressApp();
  }

  private createExpressApp(): Express {
    const app = express();
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true }));
    app.use(this.requestLogger.middleware());

    // Mount UI, Auth, and Console managers
    app.use(this.demo.router);
    app.use(this.auth.router);
    app.use(this.console.router);

    // Mount Shopee Open Platform v2 domain managers
    app.use("/api/v2/public", this.public.router);
    app.use("/api/v2/shop", this.shop.router);
    app.use("/api/v2/product", this.product.router);
    app.use("/api/v2/order", this.order.router);
    app.use("/api/v2/logistics", this.logistics.router);
    app.use("/api/v2/payment", this.payment.router);
    app.use("/api/v2/returns", this.returns.router);
    app.use("/api/v2/voucher", this.voucher.router);
    app.use("/api/v2/discount", this.discount.router);
    app.use("/api/v2/bundle_deal", this.bundleDeal.router);
    app.use("/api/v2/follow_prize", this.followPrize.router);
    app.use("/api/v2/shop_category", this.shopCategory.router);
    app.use("/api/v2/media", this.media.router);
    app.use("/api/v2/media_space", this.mediaSpace.router);

    // Universal 455-schema fallback & 404 handler
    app.use(this.schemaFallback.router);

    return app;
  }

  public start(port = this.config.port): Server {
    const reg = this.schemaRegistry.load();
    return this.app.listen(port, () => {
      console.log(`\n🛒 Shopee Mock Server (TypeScript) running at http://localhost:${port}`);
      console.log(`   ⚡ Open Platform Console : http://localhost:${port}/console`);
      console.log(`   🏪 Shopee Seller Centre  : http://localhost:${port}/`);
      console.log(`   🔑 OAuth Authorize Page  : http://localhost:${port}/auth`);
      console.log(
        `   📦 Loaded Schemas        : ${reg.list.length} APIs across ${Object.keys(reg.modules).length} modules`
      );
      console.log(
        `   🔐 Credentials           : partner_id=${this.config.partnerId} | shop_id=${this.config.shopId} | STRICT_SIG=${this.config.strictSig}\n`
      );
    });
  }
}
