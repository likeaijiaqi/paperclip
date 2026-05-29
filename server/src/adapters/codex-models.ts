import type { AdapterModel } from "./types.js";
import { spawnSync } from "node:child_process";
import { models as codexFallbackModels } from "@paperclipai/adapter-codex-local";
import { readConfigFile } from "../config-file.js";

const OPENAI_MODELS_ENDPOINT = "https://api.openai.com/v1/models";
const OPENAI_MODELS_TIMEOUT_MS = 5000;
const OPENAI_MODELS_CACHE_TTL_MS = 60_000;
const CODEX_MODELS_TIMEOUT_MS = 5000;

let cached: { cacheKey: string; expiresAt: number; models: AdapterModel[] } | null = null;
let codexModelsRunnerForTests: (() => {
  status: number | null;
  stdout: string;
  stderr: string;
  hasError?: boolean;
}) | null = null;

function fingerprint(apiKey: string): string {
  return `${apiKey.length}:${apiKey.slice(-6)}`;
}

function dedupeModels(models: AdapterModel[]): AdapterModel[] {
  const seen = new Set<string>();
  const deduped: AdapterModel[] = [];
  for (const model of models) {
    const id = model.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push({ id, label: model.label.trim() || id });
  }
  return deduped;
}

function mergedWithFallback(models: AdapterModel[]): AdapterModel[] {
  return dedupeModels([
    ...models,
    ...codexFallbackModels,
  ]).sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true, sensitivity: "base" }));
}

function parseCodexDebugModels(stdout: string): AdapterModel[] {
  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch {
    return [];
  }

  const rawModels =
    Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as { models?: unknown }).models)
        ? (payload as { models: unknown[] }).models
        : [];

  const models: AdapterModel[] = [];
  for (const item of rawModels) {
    if (typeof item === "string") {
      models.push({ id: item, label: item });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = [record.slug, record.id, record.model, record.name]
      .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)
      ?.trim();
    if (!id) continue;
    const label = [record.display_name, record.label, record.name]
      .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)
      ?.trim();
    models.push({ id, label: label ?? id });
  }
  return dedupeModels(models);
}

function fetchLocalCodexModels(): AdapterModel[] {
  const result = codexModelsRunnerForTests
    ? codexModelsRunnerForTests()
    : spawnSync("codex", ["debug", "models"], {
      encoding: "utf8",
      timeout: CODEX_MODELS_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });

  const hasError =
    "hasError" in result
      ? result.hasError
      : "error" in result
        ? Boolean(result.error)
        : false;
  if ((result.status ?? 1) !== 0 || hasError) return [];
  return parseCodexDebugModels(result.stdout);
}

function resolveOpenAiApiKey(): string | null {
  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) return envKey;

  const config = readConfigFile();
  if (config?.llm?.provider !== "openai") return null;
  const configKey = config.llm.apiKey?.trim();
  return configKey && configKey.length > 0 ? configKey : null;
}

async function fetchOpenAiModels(apiKey: string): Promise<AdapterModel[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_MODELS_TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_MODELS_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as { data?: unknown };
    const data = Array.isArray(payload.data) ? payload.data : [];
    const models: AdapterModel[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) continue;
      const id = (item as { id?: unknown }).id;
      if (typeof id !== "string" || id.trim().length === 0) continue;
      models.push({ id, label: id });
    }
    return dedupeModels(models);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function loadCodexModels(options?: { forceRefresh?: boolean }): Promise<AdapterModel[]> {
  const forceRefresh = options?.forceRefresh === true;
  const apiKey = resolveOpenAiApiKey();
  const fallback = dedupeModels(codexFallbackModels);

  const now = Date.now();
  const cacheKey = apiKey ? `local+openai:${fingerprint(apiKey)}` : "local";
  if (!forceRefresh && cached && cached.cacheKey === cacheKey && cached.expiresAt > now) {
    return cached.models;
  }

  const localCodexModels = fetchLocalCodexModels();
  if (localCodexModels.length > 0) {
    const merged = mergedWithFallback(localCodexModels);
    cached = {
      cacheKey,
      expiresAt: now + OPENAI_MODELS_CACHE_TTL_MS,
      models: merged,
    };
    return merged;
  }

  const fetched = apiKey ? await fetchOpenAiModels(apiKey) : [];
  if (fetched.length > 0) {
    const merged = mergedWithFallback(fetched);
    cached = {
      cacheKey,
      expiresAt: now + OPENAI_MODELS_CACHE_TTL_MS,
      models: merged,
    };
    return merged;
  }

  if (cached && cached.cacheKey === cacheKey && cached.models.length > 0) {
    return cached.models;
  }

  return fallback;
}

export async function listCodexModels(): Promise<AdapterModel[]> {
  return loadCodexModels();
}

export async function refreshCodexModels(): Promise<AdapterModel[]> {
  return loadCodexModels({ forceRefresh: true });
}

export function resetCodexModelsCacheForTests() {
  cached = null;
}

export function setCodexModelsRunnerForTests(runner: typeof codexModelsRunnerForTests) {
  codexModelsRunnerForTests = runner;
}
