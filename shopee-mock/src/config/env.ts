import path from 'path';

export interface AppConfig {
  readonly partnerId: string;
  readonly partnerKey: string;
  readonly port: number;
  readonly odooBaseUrl: string;
  readonly strictSig: boolean;
  readonly stateFile: string;
  readonly schemasDir: string;
  readonly publicDir: string;
}

export const CONFIG: AppConfig = {
  partnerId: process.env.PARTNER_ID || '1',
  partnerKey: process.env.PARTNER_KEY || '1',
  port: Number(process.env.PORT || 3000),
  odooBaseUrl: (process.env.ODOO_BASE_URL || '').replace(/\/$/, ''),
  strictSig: process.env.STRICT_SIG === 'true',
  stateFile:
    process.env.STATE_FILE || path.resolve(__dirname, '../../shopee_mock_state.json'),
  schemasDir:
    process.env.SCHEMAS_DIR || path.resolve(__dirname, '../../../shopee-sdk/schemas'),
  publicDir: path.resolve(__dirname, '../../public'),
};

export function rid(): string {
  return 'mock_' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

export function ts(): number {
  return Math.floor(Date.now() / 1000);
}

export function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

export function parseListParam(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .flatMap((item) => String(item).split(','))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
