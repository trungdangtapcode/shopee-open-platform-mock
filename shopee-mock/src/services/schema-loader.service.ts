import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config/env';

export interface SchemaParam {
  name: string;
  type?: string;
  sample?: unknown;
  required?: boolean | string;
  description?: string;
  children?: SchemaParam[];
}

export interface FallbackRouteSpec {
  api_name: string;
  method: 'GET' | 'POST';
  samplePayload: Record<string, unknown>;
}

export interface CatalogEndpoint {
  api_name: string;
  module: string;
  method: 'GET' | 'POST';
  path: string;
  api_type: string;
  description: string;
  sample_request: Record<string, unknown>;
  param_docs: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
}

function stripHtml(html: unknown): string {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildFromParams(params?: SchemaParam[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const p of params || []) {
    if (['error', 'message', 'request_id', 'warning'].includes(p.name)) continue;
    const t = (p.type || '').toLowerCase();
    if (t.includes('[]')) {
      obj[p.name] = p.children && p.children.length ? [buildFromParams(p.children)] : [];
    } else if (t === 'object' || (p.children && p.children.length)) {
      obj[p.name] = buildFromParams(p.children);
    } else if (t.includes('int') || t.includes('float') || t.includes('number') || t === 'timestamp') {
      obj[p.name] = Number(p.sample) || 0;
    } else if (t === 'boolean') {
      obj[p.name] = p.sample === 'true' || p.sample === true;
    } else {
      obj[p.name] = p.sample || '';
    }
  }
  return obj;
}

function buildSampleRequestFromParams(params?: SchemaParam[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const p of params || []) {
    if (['partner_id', 'timestamp', 'access_token', 'shop_id', 'sign', 'merchant_id'].includes(p.name)) {
      continue;
    }
    const t = (p.type || '').toLowerCase();
    if (t.includes('[]')) {
      if (p.children && p.children.length) {
        obj[p.name] = [buildSampleRequestFromParams(p.children)];
      } else if (t.includes('int') || t.includes('number')) {
        obj[p.name] = [Number(p.sample) || 10001];
      } else {
        obj[p.name] = [p.sample || 'SPX20260521001'];
      }
    } else if (t === 'object' || (p.children && p.children.length)) {
      obj[p.name] = buildSampleRequestFromParams(p.children);
    } else if (t.includes('int') || t.includes('float') || t.includes('number') || t === 'timestamp') {
      obj[p.name] = p.sample !== undefined && p.sample !== '' ? Number(p.sample) : 1;
    } else if (t === 'boolean') {
      obj[p.name] = p.sample === 'true' || p.sample === true;
    } else {
      obj[p.name] = p.sample !== undefined ? String(p.sample) : '';
    }
  }
  return obj;
}

let cachedSchemaMap: Map<string, FallbackRouteSpec> | null = null;
let cachedCatalog: CatalogEndpoint[] | null = null;

export function getSchemaRegistry(schemasDir: string = CONFIG.schemasDir): {
  schemaMap: Map<string, FallbackRouteSpec>;
  catalog: CatalogEndpoint[];
} {
  if (cachedSchemaMap && cachedCatalog) {
    return { schemaMap: cachedSchemaMap, catalog: cachedCatalog };
  }

  const schemaMap = new Map<string, FallbackRouteSpec>();
  const catalog: CatalogEndpoint[] = [];

  if (!schemasDir || !fs.existsSync(schemasDir)) {
    cachedSchemaMap = schemaMap;
    cachedCatalog = catalog;
    return { schemaMap, catalog };
  }

  try {
    const files = fs.readdirSync(schemasDir).filter((f) => f.endsWith('.json')).sort();
    for (const file of files) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(schemasDir, file), 'utf8'));
        if (!raw.path || !raw.api_name) continue;

        let samplePayload: Record<string, unknown> | null = null;
        if (Array.isArray(raw.response_sample) && raw.response_sample.length > 0) {
          const val = raw.response_sample[0].value;
          if (typeof val === 'object' && val !== null) {
            samplePayload = val as Record<string, unknown>;
          } else if (typeof val === 'string') {
            try {
              samplePayload = JSON.parse(val);
            } catch (_) {}
          }
        }
        if (!samplePayload) {
          samplePayload = {
            error: '',
            message: '',
            response: buildFromParams(raw.params?.response_params),
          };
        }

        const method: 'GET' | 'POST' = raw.method === 1 ? 'POST' : 'GET';
        schemaMap.set(raw.path, {
          api_name: raw.api_name,
          method,
          samplePayload,
        });

        const parts = String(raw.api_name).split('.');
        const reqParams: SchemaParam[] = raw.params?.request_params || [];
        const defineContent =
          raw.define && typeof raw.define === 'object' ? raw.define.content : raw.define;

        catalog.push({
          api_name: raw.api_name,
          module: parts[1] || 'other',
          method,
          path: raw.path,
          api_type: raw.api_type || 'Shop',
          description: stripHtml(defineContent) || `${method} ${raw.path}`,
          sample_request: buildSampleRequestFromParams(reqParams),
          param_docs: reqParams.slice(0, 25).map((p) => ({
            name: p.name,
            type: p.type || 'string',
            required: p.required === 'True' || p.required === true,
            description: stripHtml(p.description).slice(0, 140),
          })),
        });
      } catch (_) {}
    }
    console.log(`[SCHEMA-ENGINE] Loaded ${schemaMap.size} Shopee v2 endpoint schemas from ${schemasDir}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[SCHEMA-ENGINE] Could not load schemas:`, msg);
  }

  cachedSchemaMap = schemaMap;
  cachedCatalog = catalog;
  return { schemaMap, catalog };
}
