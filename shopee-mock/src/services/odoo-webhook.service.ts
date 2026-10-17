import { CONFIG, ts } from '../config/env';
import { DB } from '../store/database';

export async function notifyOdooDelivered(order_sn: string): Promise<void> {
  if (!CONFIG.odooBaseUrl) {
    console.warn(`[WEBHOOK] ODOO_BASE_URL not set — skipping delivery notification for ${order_sn}`);
    return;
  }
  const candidatePaths = [
    '/shopee/webhook',
    '/web/shopee/webhook',
    '/shopee_connector/webhook',
    '/web/action/shopee_connector.action_shopee_webhook',
  ];
  const payload = {
    code: 3,
    timestamp: ts(),
    shop_id: DB.shop.shop_id,
    data: { ordersn: order_sn, status: 'COMPLETED', update_time: ts() },
  };
  for (const p of candidatePaths) {
    const url = `${CONFIG.odooBaseUrl}${p}`;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        console.log(`[WEBHOOK] ✅ Odoo notified at ${url} — order ${order_sn} COMPLETED`);
        return;
      }
      console.warn(`[WEBHOOK] ${url} responded ${resp.status} — trying next path`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[WEBHOOK] ${url} unreachable — ${msg}`);
    }
  }
  console.warn(`[WEBHOOK] ⚠️ All Odoo webhook paths failed for ${order_sn}.`);
}
