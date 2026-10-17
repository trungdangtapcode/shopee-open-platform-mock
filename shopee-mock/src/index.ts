import { createApp } from './app';
import { CONFIG } from './config/env';

export const app = createApp();

if (require.main === module) {
  const port = Number(process.env.PORT || CONFIG.port);
  const partnerId = process.env.PARTNER_ID || CONFIG.partnerId;
  const partnerKey = process.env.PARTNER_KEY || CONFIG.partnerKey;

  app.listen(port, () => {
    console.log(`\n🟠 Shopee Mock API v5.0 (TypeScript Modular) running on port ${port}`);
    console.log(`   Partner ID   : ${partnerId}`);
    console.log(`   Partner Key  : ${partnerKey}`);
    console.log(`   Odoo base URL: ${CONFIG.odooBaseUrl || '(not set)'}`);
    console.log(`   Strict sig   : ${process.env.STRICT_SIG || 'false (demo mode)'}`);
    console.log(`   State file   : ${CONFIG.stateFile}`);
    console.log(`   Console UI   : http://localhost:${port}/console`);
    console.log(`   Seller UI    : http://localhost:${port}/\n`);
  });
}

export default app;
