import http from "http";
import { ShopeeMockConfig } from "../schemas";
import { ts } from "./helpers";

export function notifyOdooDelivered(config: ShopeeMockConfig, orderSn: string, trackingNo: string): void {
  const payload = JSON.stringify({
    code: 3,
    shop_id: config.shopId,
    timestamp: ts(),
    data: {
      ordersn: orderSn,
      status: "COMPLETED",
      tracking_no: trackingNo,
      update_time: ts(),
    },
  });

  try {
    const url = new URL(config.odooWebhookUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        console.log(`  📡 Odoo webhook notified for ${orderSn} → HTTP ${res.statusCode}`);
      }
    );
    req.on("error", (e) => {
      console.warn(`  ⚠️  Odoo webhook failed (${config.odooWebhookUrl}): ${e.message}`);
    });
    req.write(payload);
    req.end();
  } catch (e) {
    const err = e as Error;
    console.warn("  ⚠️  Invalid ODOO_WEBHOOK_URL:", err.message);
  }
}
