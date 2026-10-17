import fs from "fs";
import path from "path";
import { rid, ts } from "./helpers";

export interface SchemaParam {
  name?: string;
  type?: string;
  required?: string;
  description?: string;
  sample?: unknown;
  children?: SchemaParam[];
}

export interface SchemaItem {
  api_name: string;
  module: string;
  method: string;
  path: string;
  api_type: string;
  description: string;
  params: {
    request_params?: SchemaParam[];
    response_params?: SchemaParam[];
  };
  response_sample: Record<string, unknown> | null;
}

export interface SchemaRegistryData {
  byPath: Map<string, SchemaItem>;
  list: SchemaItem[];
  modules: Record<string, number>;
}

function extractPathFromUrl(apiUrl: unknown, apiName: string): string {
  if (typeof apiUrl === "string" && apiUrl.includes("/api/v2/")) {
    const idx = apiUrl.indexOf("/api/v2/");
    return apiUrl.slice(idx).split("?")[0].trim();
  }
  const parts = String(apiName || "").split(".");
  if (parts.length >= 3 && parts[0] === "v2") {
    return `/api/v2/${parts[1]}/${parts.slice(2).join("/")}`;
  }
  return "";
}

function buildValueFromParamSpec(param: SchemaParam | undefined): unknown {
  if (!param) return null;
  const type = String(param.type || "").toLowerCase();
  if (Array.isArray(param.children) && param.children.length > 0) {
    if (type.includes("[]") || type.includes("array") || type.includes("list")) {
      const childObj: Record<string, unknown> = {};
      for (const child of param.children) {
        if (child?.name) childObj[child.name] = buildValueFromParamSpec(child);
      }
      return [childObj];
    }
    const obj: Record<string, unknown> = {};
    for (const child of param.children) {
      if (child?.name) obj[child.name] = buildValueFromParamSpec(child);
    }
    return obj;
  }
  if (param.sample !== undefined && param.sample !== "") {
    if (type.includes("int") || type.includes("float") || type.includes("number") || type === "timestamp") {
      const n = Number(param.sample);
      if (!Number.isNaN(n)) return n;
    }
    if (type.includes("bool")) {
      return String(param.sample).toLowerCase() === "true";
    }
    return param.sample;
  }
  if (type.includes("[]") || type.includes("array") || type.includes("list")) return [];
  if (type === "timestamp") return ts();
  if (type.includes("int") || type.includes("number") || type.includes("float")) return 0;
  if (type.includes("bool")) return false;
  if (type.includes("object")) return {};
  return "";
}

export function buildResponseFromSchema(schema: SchemaItem): Record<string, unknown> {
  if (schema.response_sample && typeof schema.response_sample === "object") {
    const cloned = JSON.parse(JSON.stringify(schema.response_sample)) as Record<string, unknown>;
    cloned.request_id = rid();
    cloned.error = "";
    cloned.message = "";
    return cloned;
  }

  const responseParams = schema.params?.response_params || [];
  const rootObj: Record<string, unknown> = { error: "", message: "", request_id: rid() };
  const hasExplicitResponseChild = responseParams.some((p) => p?.name === "response");

  if (hasExplicitResponseChild) {
    for (const p of responseParams) {
      if (!p?.name || p.name === "request_id") continue;
      if (p.name === "error" || p.name === "message") {
        rootObj[p.name] = "";
      } else {
        rootObj[p.name] = buildValueFromParamSpec(p);
      }
    }
  } else {
    const innerResponse: Record<string, unknown> = {};
    for (const p of responseParams) {
      if (!p?.name || ["error", "message", "request_id", "warning"].includes(p.name)) continue;
      innerResponse[p.name] = buildValueFromParamSpec(p);
    }
    rootObj.response = innerResponse;
  }
  return rootObj;
}

export class SchemaRegistry {
  private cache: SchemaRegistryData | null = null;

  constructor(private readonly schemasDir: string) {}

  public load(): SchemaRegistryData {
    if (this.cache) return this.cache;

    const byPath = new Map<string, SchemaItem>();
    const list: SchemaItem[] = [];
    const modules: Record<string, number> = {};

    if (!fs.existsSync(this.schemasDir)) {
      this.cache = { byPath, list, modules };
      return this.cache;
    }

    const files = fs.readdirSync(this.schemasDir).filter((f) => f.endsWith(".json")).sort();
    for (const file of files) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(this.schemasDir, file), "utf8"));
        const apiName = String(raw.api_name || file.replace(/\.json$/, ""));
        const parts = apiName.split(".");
        const mod = parts.length >= 2 ? parts[1] : "other";
        const apiPath = extractPathFromUrl(raw.api_url, apiName);
        if (!apiPath) continue;

        let responseSample: Record<string, unknown> | null = null;
        if (Array.isArray(raw.response_sample) && raw.response_sample.length > 0) {
          const sampleEntry = raw.response_sample[0];
          if (sampleEntry && typeof sampleEntry.value === "object" && sampleEntry.value !== null) {
            responseSample = sampleEntry.value as Record<string, unknown>;
          }
        }

        const item: SchemaItem = {
          api_name: apiName,
          module: mod,
          method: raw.http_method === 2 || String(raw.http_method).toUpperCase() === "GET" ? "GET" : "POST",
          path: apiPath,
          api_type: String(raw.api_type || "Shop"),
          description: String(raw.define || ""),
          params: raw.params || {},
          response_sample: responseSample,
        };

        byPath.set(apiPath, item);
        list.push(item);
        modules[mod] = (modules[mod] || 0) + 1;
      } catch (_) {
        // Skip invalid schema files
      }
    }

    this.cache = { byPath, list, modules };
    return this.cache;
  }
}
