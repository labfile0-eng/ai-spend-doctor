// AI Spend Doctor engine: CSV parsing, price list, cost reading and checks.
// Pure functions, no DOM and no network. Used by the page (window.ASD) and by the tests (require).
(function (root) {
"use strict";

// ---------------------------------------------------------------- price list
const PRICES_CHECKED = "27 September 2026";
const SOURCES = {
  anthropic: "https://platform.claude.com/docs/en/about-claude/pricing",
  openai: "https://developers.openai.com/api/docs/pricing",
};
// USD per million tokens, standard tier, short context.
// i input, o output, cr cache read, cw5/cw1h Claude cache writes, cw OpenAI cache write,
// tok: "new" for Claude models on the newer tokenizer (Claude 4.7 and later), which the
// pricing page says produces about 30% more tokens for the same text.
const A = (id, label, i, o, cr, cw5, cw1h, tok, alias) => ({id, label, provider: "anthropic", i, o, cr, cw5, cw1h, tok, alias: alias || []});
const O = (id, label, i, o, cr, cw) => ({id, label, provider: "openai", i, o, cr, cw: cw ?? i, alias: []});
const PRICE_LIST = [
  A("fable-5-1", "Claude Fable 5.1", 10, 50, 0.25, 12.5, 20, "new", ["mythos-5-1"]),
  A("fable-5", "Claude Fable 5", 10, 50, 1, 12.5, 20, "new", ["mythos-5"]),
  A("opus-5-5", "Claude Opus 5.5", 4, 20, 0.2, 5, 8, "new"),
  A("opus-5", "Claude Opus 5", 5, 25, 0.5, 6.25, 10, "new"),
  A("opus-4-8", "Claude Opus 4.8", 5, 25, 0.5, 6.25, 10, "new"),
  A("opus-4-7", "Claude Opus 4.7", 5, 25, 0.5, 6.25, 10, "new"),
  A("opus-4-6", "Claude Opus 4.6", 5, 25, 0.5, 6.25, 10, "old"),
  A("opus-4-5", "Claude Opus 4.5", 5, 25, 0.5, 6.25, 10, "old"),
  A("opus-4-1", "Claude Opus 4.1", 15, 75, 1.5, 18.75, 30, "old"),
  A("opus-4", "Claude Opus 4", 15, 75, 1.5, 18.75, 30, "old"),
  A("sonnet-5", "Claude Sonnet 5", 2, 10, 0.2, 2.5, 4, "new"),
  A("sonnet-4-6", "Claude Sonnet 4.6", 3, 15, 0.3, 3.75, 6, "old"),
  A("sonnet-4-5", "Claude Sonnet 4.5", 3, 15, 0.3, 3.75, 6, "old"),
  A("sonnet-4", "Claude Sonnet 4", 3, 15, 0.3, 3.75, 6, "old"),
  A("haiku-4-5", "Claude Haiku 4.5", 1, 5, 0.1, 1.25, 2, "old"),
  A("haiku-3-5", "Claude Haiku 3.5", 0.8, 4, 0.08, 1, 1.6, "old", ["3-5-haiku"]),
  O("gpt-6-astra", "GPT-6 Astra", 10, 50, 1, 12.5),
  O("gpt-6-sol", "GPT-6 Sol", 2, 10, 0.2, 2.5),
  O("gpt-6-luna", "GPT-6 Luna", 0.1, 0.5, 0.01, 0.125),
  O("gpt-5-6-sol", "GPT-5.6 Sol", 4, 20, 0.4, 5),
  O("gpt-5-6-terra", "GPT-5.6 Terra", 2, 12, 0.2, 2.5),
  O("gpt-5-6-luna", "GPT-5.6 Luna", 0.2, 1.2, 0.02, 0.25),
  O("gpt-5-5", "GPT-5.5", 5, 30, 0.5),
  O("gpt-5-4-mini", "GPT-5.4 mini", 0.75, 4.5, 0.075),
  O("gpt-5-4-nano", "GPT-5.4 nano", 0.2, 1.25, 0.02),
  O("gpt-5-4", "GPT-5.4", 2.5, 15, 0.25),
  O("gpt-5-2", "GPT-5.2", 1.75, 14, 0.175),
  O("gpt-5-1", "GPT-5.1", 1.25, 10, 0.125),
  O("gpt-5-mini", "GPT-5 mini", 0.25, 2, 0.025),
  O("gpt-5-nano", "GPT-5 nano", 0.05, 0.4, 0.005),
  O("gpt-5", "GPT-5", 1.25, 10, 0.125),
  O("gpt-4-1-mini", "GPT-4.1 mini", 0.4, 1.6, 0.1),
  O("gpt-4-1", "GPT-4.1", 2, 8, 0.5),
  O("gpt-4o-mini", "GPT-4o mini", 0.15, 0.6, 0.075),
  O("gpt-4o", "GPT-4o", 2.5, 10, 1.25),
  O("o4-mini", "o4-mini", 1.1, 4.4, 0.275),
  O("o3", "o3", 2, 8, 0.5),
];
// Older model -> current model of the same tier (Claude only; OpenAI tiers do not map one to one).
const SUCCESSOR = {"opus-4": "opus-5-5", "opus-4-1": "opus-5-5", "opus-4-7": "opus-5-5", "opus-4-8": "opus-5-5", "opus-5": "opus-5-5",
  "opus-4-5": "opus-5-5", "opus-4-6": "opus-5-5", "sonnet-4": "sonnet-5", "sonnet-4-5": "sonnet-5", "sonnet-4-6": "sonnet-5"};
const TOKENIZER_FACTOR = 1.3;
const PREMIUM = /opus|fable|mythos|astra/;

const norm = s => String(s ?? "").toLowerCase().trim().replace(/[\s._:]+/g, "-").replace(/-+/g, "-");
// OpenRouter slugs put the version first ("claude-4.5-sonnet"); turn them into "claude-sonnet-4-5"
const stripDate = s => s.replace(/-(\d{8}|20\d\d-\d\d-\d\d|latest)$/, "").replace(/claude-(\d+(?:-\d+)?)-(opus|sonnet|haiku)$/, "claude-$2-$1");
function findPrice(model) {
  if (!model) return null;
  const k = stripDate(norm(model));
  for (const p of PRICE_LIST) for (const id of [p.id, ...p.alias])
    if (k === id || k.endsWith("-" + id) || k.endsWith("/" + id)) return p;
  return null;
}
const byId = id => PRICE_LIST.find(p => p.id === id);

// ---------------------------------------------------------------- CSV
function parseCSV(text) {
  text = String(text).replace(/^﻿/, "");
  const first = text.slice(0, text.search(/\r?\n|$/));
  const count = ch => (first.match(new RegExp("\\" + ch, "g")) || []).length;
  const sep = [",", ";", "\t"].sort((a, b) => count(b) - count(a))[0];
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return {sep, rows: rows.filter(r => r.some(x => String(x).trim() !== "")), error: q ? "malformed-csv" : null};
}
function makeNum(sep) {
  return v => {
    let s = String(v ?? "").trim().replace(/^\$|\s|USD$/gi, "");
    if (s === "") return NaN;
    if (sep === ";" && /^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
    if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };
}
// "2026-09-01", "2026-09-01T00:00:00Z", Unix seconds or ms, "09/01/2026", "Sep 1, 2026" -> "2026-09-01" (UTC), or ""
function toDay(v) {
  const s = String(v ?? "").trim();
  const validDate = (y, m, day) => {
    const d = new Date(Date.UTC(y, m - 1, day));
    return d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === day;
  };
  let t;
  if (/^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(s)) {
    if (s[10] === " ") return toDay(s.slice(0, 10) + "T" + s.slice(11).trim());
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    if (!validDate(y, m, d)) return "";
    // A timezone-free timestamp is interpreted as UTC, never the viewer's local zone.
    t = Date.parse(s.length === 10 ? s + "T00:00:00Z" : /(?:Z|[+-]\d{2}:?\d{2})$/i.test(s) ? s : s + "Z");
  }
  else if (/^\d{10}(\.\d+)?$/.test(s)) t = Number(s) * 1000;
  else if (/^\d{13}$/.test(s)) t = Number(s);
  else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [m, d, y] = s.split("/").map(Number); if (!validDate(y, m, d)) return ""; t = Date.UTC(y, m - 1, d);
  } else {
    const match = s.match(/^([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/i);
    if (match) {
      const m = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
      const d = Number(match[2]), y = Number(match[3]);
      if (!validDate(y, m, d)) return ""; t = Date.UTC(y, m - 1, d);
    }
  }
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  if (d.getUTCFullYear() < 2020 || d.getUTCFullYear() > 2100) return "";
  return d.toISOString().slice(0, 10);
}
// "Claude Sonnet 5 Usage - Input Tokens", "gpt-6-sol, cached input" -> the model part
function cleanModel(raw) {
  let s = String(raw ?? "").split(/,|\||\s[-–]\s/)[0].trim();
  s = s.replace(/\s+(usage|input|output|cached?|cache\s+(read|write|creation)|tokens?|batch)\b.*$/i, "").trim();
  return s;
}
function kindOf(s) {
  const t = String(s ?? "").toLowerCase();
  if (/uncached/.test(t)) return "input";
  if (/cache.?read|cached/.test(t)) return "cached";
  if (/cache.?(creation|write)/.test(t)) return /1h/.test(t) ? "cw1h" : "cw";
  if (/output|completion/.test(t)) return "output";
  if (/input|prompt/.test(t)) return "input";
  return "";
}

// ---------------------------------------------------------------- columns
const H = s => norm(s).replace(/[()]/g, "");
function detect(header) {
  const h = header.map(H), used = new Set();
  const exact = (names, re) => {
    let i = h.findIndex((x, j) => !used.has(j) && names.includes(x));
    if (i < 0 && re) i = h.findIndex((x, j) => !used.has(j) && re.test(x));
    if (i >= 0) used.add(i);
    return i >= 0 ? i : null;
  };
  const m = {};
  m.currency = exact(["currency", "amount-currency", "cost-currency"]);
  m.costType = exact(["cost-type"]); m.tokenType = exact(["token-type"]);
  m.tier = exact(["service-tier"]); m.batch = exact(["batch", "is-batch"]); m.geo = exact(["inference-geo"]);
  // money
  const usdNames = ["cost-usd", "amount-usd", "usd", "cost-usd-", "total-cost-usd", "spend-usd", "cost-in-usd", "cost-total"];
  const centNames = ["cost-cents", "amount-cents", "cents", "cost-usd-cents"];
  m.cost = exact(usdNames); m.unit = m.cost != null ? "usd" : null;
  if (m.cost == null) { m.cost = exact(centNames, /cent/); if (m.cost != null) m.unit = "cents"; }
  if (m.cost == null) { m.cost = exact(["amount", "cost", "spend", "total-cost", "total", "charge", "cost-amount", "price"],
    /^(?!.*(type|currency|unit|quantity|per))(?=.*(cost|amount|spend|charge))/); if (m.cost != null) m.unit = "ambiguous"; }
  if (m.unit === "usd" && /cent/.test(h[m.cost])) m.unit = "cents";
  // tokens
  m.uncached = exact(["uncached-input-tokens", "input-uncached-tokens"]);
  m.cached = exact(["cache-read-input-tokens", "input-cached-tokens", "cached-input-tokens", "cached-tokens", "cache-read-tokens"]);
  m.cw5 = exact([], /cache.*5m/); m.cw1h = exact([], /cache.*1h/);
  m.cwAgg = exact(["cache-creation-input-tokens", "cache-write-tokens", "input-cache-write-tokens", "cache-creation-tokens"]);
  m.input = exact(["input-tokens", "prompt-tokens", "input", "n-context-tokens-total", "tokens-prompt"], /^(?!.*(cach|audio|image))(?=.*(input|prompt)).*tokens?$/);
  m.output = exact(["output-tokens", "completion-tokens", "output", "n-generated-tokens-total", "tokens-completion"], /^(?!.*(audio|image))(?=.*(output|completion)).*tokens?$/);
  // context
  m.date = exact(["date", "day", "usage-date", "start-time", "starting-at", "bucket-start-time", "start", "period", "timestamp", "time", "start-date", "created-at", "created"],
    /^(?!.*end)(date|day|time|bucket|period)/);
  m.model = exact(["model", "model-name", "model-id", "model-permaslug", "model-slug"], null);
  m.byok = exact(["byok-usage-inference"]);
  m.desc = exact(["line-item", "description", "product", "sku", "line-item-name"], /line.?item|description/);
  m.hasTokens = [m.uncached, m.cached, m.cw5, m.cw1h, m.cwAgg, m.input, m.output].some(x => x != null);
  // input semantics: "separate" (Claude: input excludes cache reads/writes) or "inclusive" (OpenAI: input includes cached and cache-write)
  const has = re => h.some(x => re.test(x));
  m.inputSemantics = m.uncached != null || has(/^cache-read-input-tokens$/) || has(/cache-creation/) ? "separate"
    : has(/^input-cached-tokens$/) ? "inclusive" : "by-provider";
  // Anthropic Cost API shape: amount in cents as a decimal string, with cost_type / token_type columns
  m.anthropicCostApi = m.unit === "ambiguous" && H(header[m.cost]) === "amount" && m.costType != null && m.tokenType != null;
  return m;
}

// ---------------------------------------------------------------- read the file
const TOTAL_ROW = /^(total|grand-total|subtotal|sum)$/;
function analyse(text, opts) {
  opts = opts || {};
  const {sep, rows, error} = parseCSV(text);
  const out = {rows: Math.max(0, rows.length - 1), header: rows[0] || [], problems: []};
  if (error) { out.error = error; return out; }
  if (rows.length < 2) { out.error = rows.length ? "header-only" : "empty"; return out; }
  const header = rows[0].map(x => String(x).trim()), map = detect(header), num = makeNum(sep);
  out.map = map;
  if (map.cost == null && !map.hasTokens) { out.error = "no-columns"; return out; }
  // unit for the cost column
  let unit = map.unit, unitReason;
  if (map.cost != null) {
    if (unit === "ambiguous") {
      if (map.anthropicCostApi) { unit = "cents"; unitReason = "anthropic-cost-api"; }
      else if (H(header[map.cost]) === "amount-value") { unit = "usd"; unitReason = "openai-costs"; }
      else { unit = "usd"; unitReason = "assumed"; }
    } else unitReason = "header";
    if (opts.unit === "usd" || opts.unit === "cents") { unit = opts.unit; unitReason = "user"; }
  }
  out.unit = unit; out.unitReason = unitReason; out.unitHeader = map.cost != null ? header[map.cost] : "";

  const C = {used: 0, reported: 0, estimated: 0, unpriced: 0, noData: 0, total: 0, currency: 0, credit: 0, badDate: 0, zero: 0, invalid: 0, invalidTokens: 0};
  let reported = 0, estimated = 0, credits = 0, byok = 0;
  const currencies = new Map(), unpricedModels = new Map(), unpricedReasons = new Map(), assumptions = new Set();
  const items = []; // normalized rows
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r], cell = i => i == null ? "" : String(row[i] ?? "").trim();
    const invalid = reason => { C.invalid++; if (out.problems.length < 8) out.problems.push({dataRow: r, reason}); };
    if (row.length !== header.length) { invalid("column-count"); continue; }
    const rawModel = cleanModel(cell(map.model)) || cleanModel(cell(map.desc));
    const kindText = [cell(map.tokenType), cell(map.desc), cell(map.model).includes(",") ? cell(map.model) : ""].join(" ");
    if ([rawModel, cell(map.desc), cell(map.date)].some(x => TOTAL_ROW.test(norm(x)))) { C.total++; continue; }
    const price = findPrice(rawModel);
    const cur = cell(map.currency).toLowerCase();
    if (cur && cur !== "usd" && cur !== "$") { C.currency++; currencies.set(cur.toUpperCase(), (currencies.get(cur.toUpperCase()) || 0) + 1); continue; }
    if (map.byok != null) { const b = num(cell(map.byok)); if (Number.isFinite(b) && b > 0) byok += b; }
    const day = map.date != null ? toDay(cell(map.date)) : "";
    // tier
    const tierText = cell(map.tier).toLowerCase(), batchText = cell(map.batch).toLowerCase();
    let tier = null;
    if (tierText) tier = new Map([["batch", "batch"], ["flex", "flex"], ["priority", "priority"], ["fast", "priority"], ["standard", "standard"], ["default", "standard"]]).get(tierText) || "unsupported";
    else if (batchText) tier = /^(true|1|yes)$/.test(batchText) ? "batch" : /^(false|0|no)$/.test(batchText) ? "standard" : "unsupported";
    else if (/\bbatch\b/i.test(cell(map.desc))) tier = "batch";
    // tokens
    const t = k => map[k] != null ? num(cell(map[k])) : NaN;
    const tok = {input: t("input"), uncached: t("uncached"), cached: t("cached"), cw5: t("cw5"), cw1h: t("cw1h"), cwAgg: t("cwAgg"), output: t("output")};
    const provider = price ? price.provider : /^(gpt|o\d|chatgpt|text-|davinci|whisper|tts|dall)/.test(norm(rawModel)) ? "openai" : /claude|opus|sonnet|haiku|fable|mythos/.test(norm(rawModel)) ? "anthropic" : null;
    const sem = map.inputSemantics !== "by-provider" ? map.inputSemantics : provider === "openai" ? "inclusive" : provider === "anthropic" ? "separate" : null;
    const nz = v => Number.isFinite(v) ? v : 0;
    // cache writes: detail (5m/1h) has priority over the aggregate
    const hasDetail = Number.isFinite(tok.cw5) || Number.isFinite(tok.cw1h);
    const cw5 = hasDetail ? nz(tok.cw5) : nz(tok.cwAgg), cw1h = hasDetail ? nz(tok.cw1h) : 0;
    if (!hasDetail && nz(tok.cwAgg) > 0) assumptions.add("cw5");
    let uncached = NaN;
    if (Number.isFinite(tok.uncached)) uncached = tok.uncached;
    else if (Number.isFinite(tok.input)) uncached = sem === "separate" ? tok.input : sem === "inclusive" ? Math.max(0, tok.input - nz(tok.cached) - cw5 - cw1h) : NaN;
    const T = {uncached, cached: tok.cached, cw5, cw1h, output: tok.output, anyTokens: Object.values(tok).some(Number.isFinite)};
    const invalidTokens = Object.keys(tok).some(k => cell(map[k]) !== "" && (!Number.isSafeInteger(tok[k]) || tok[k] < 0))
      || (sem === "inclusive" && Number.isFinite(tok.input) && nz(tok.cached) + cw5 + cw1h > tok.input)
      || (hasDetail && Number.isFinite(tok.cwAgg) && cw5 + cw1h !== tok.cwAgg);
    if (invalidTokens) C.invalidTokens++;
    // money
    let cost = map.cost != null ? num(cell(map.cost)) : NaN, source = null;
    if (map.cost != null && cell(map.cost) && (!Number.isFinite(cost) || Math.abs(cost) > Number.MAX_SAFE_INTEGER)) { invalid("invalid-cost"); continue; }
    if (Number.isFinite(cost)) {
      if (unit === "cents") cost /= 100;
      if (cost < 0) { C.credit++; credits += cost; continue; }
      source = "reported";
    } else if (invalidTokens) { invalid("invalid-tokens"); continue;
    } else if (T.anyTokens && price && Number.isFinite(T.uncached) && Number.isFinite(T.output) && (!tier || tier === "standard" || tier === "batch" || (tier === "flex" && price.provider === "openai"))) {
      const mult = tier === "batch" || tier === "flex" ? 0.5 : 1;
      if (!tier) assumptions.add("tier-standard");
      assumptions.add("standard-context");
      if (!Number.isFinite(T.cached)) assumptions.add("no-cache-read");
      const geo = price.provider === "anthropic" && (price.tok === "new" || /-4-6$/.test(price.id)) && /^us$/i.test(cell(map.geo)) ? 1.1 : 1;
      const cwPrice = price.provider === "anthropic" ? [price.cw5, price.cw1h] : [price.cw, price.cw];
      cost = (T.uncached * price.i + nz(T.cached) * price.cr + cw5 * cwPrice[0] + cw1h * cwPrice[1] + nz(T.output) * price.o) / 1e6 * mult * geo;
      source = "estimated";
    } else if (T.anyTokens) {
      C.unpriced++; const k = rawModel || "(no model name)"; unpricedModels.set(k, (unpricedModels.get(k) || 0) + 1);
      const reason = !price ? "unknown-model" : !Number.isFinite(T.uncached) || !Number.isFinite(T.output) ? "incomplete-tokens" : "unsupported-tier";
      unpricedReasons.set(reason, (unpricedReasons.get(reason) || 0) + 1);
      continue;
    } else { C.noData++; continue; }
    if (cost === 0) C.zero++;
    C.used++; C[source]++;
    if (map.date != null && !day) C.badDate++;
    if (source === "reported") reported += cost; else estimated += cost;
    items.push({day, model: rawModel, price, provider, tier, cost, source, kind: kindOf(kindText), T, sem, invalidTokens});
  }
  Object.assign(out, {counts: C, reported, estimated, credits, byok, total: reported + estimated, items,
    currencies: [...currencies], unpricedModels: [...unpricedModels], unpricedReasons: [...unpricedReasons], assumptions: [...assumptions]});
  if (!items.length) out.error = C.invalid ? "invalid-values" : C.unpriced ? "all-unpriced" : C.currency ? "other-currency" : C.credit ? "only-credits" : "no-values";
  const days = [...new Set(items.map(x => x.day).filter(Boolean))].sort();
  out.days = days; out.datedShare = items.length ? items.filter(x => x.day).length / items.length : 0;
  out.checks = runChecks(out);
  return out;
}

// ---------------------------------------------------------------- checks
function status(coverage) { return coverage >= 1 - 1e-12 ? "checked" : coverage > 0 ? "partially_checked" : "not_available"; }
function runChecks(P) {
  const items = P.items || [], total = P.total, findings = [], scenarios = [], checks = [];
  const sumBy = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  if (!items.length) return {findings, scenarios, checks};
  const costOf = arr => sumBy(arr, x => x.cost);
  const share = arr => total > 0 ? costOf(arr) / total : 0;

  // 1. spend by day
  const byDay = new Map(), byDayModel = new Map();
  for (const x of items) if (x.day) {
    byDay.set(x.day, (byDay.get(x.day) || 0) + x.cost);
    const m = byDayModel.get(x.day) || new Map(); m.set(x.model, (m.get(x.model) || 0) + x.cost); byDayModel.set(x.day, m);
  }
  const days = [...byDay.keys()].sort();
  P.byDay = days.map(d => [d, byDay.get(d)]);
  if (days.length >= 7) {
    const vals = days.map(d => byDay.get(d)).sort((a, b) => a - b), n = vals.length;
    const median = n % 2 ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2;
    const span = Math.round((Date.parse(days[n - 1]) - Date.parse(days[0])) / 864e5) + 1;
    const spikes = days.filter(d => byDay.get(d) > 3 * median && byDay.get(d) - median > 5);
    for (const d of spikes) {
      const top = [...byDayModel.get(d)].sort((a, b) => b[1] - a[1])[0];
      findings.push({type: "spike", day: d, amt: byDay.get(d) - median, unit: "above a typical day",
        title: `${d}: spend was ${(byDay.get(d) / Math.max(median, 0.01)).toFixed(1)}× a typical day`,
        note: `${fmt(byDay.get(d))} that day, a typical day in this file is ${fmt(median)}. The largest part was ${top[0] || "unnamed"} (${fmt(top[1])}). Traffic growth, a backfill, retries or a runaway agent can all look like this.`,
        next: `Check request counts and logs for ${d}.`});
    }
    checks.push({name: "Daily spikes", status: status(P.datedShare), detail: `${days.length} days with data` + (span > days.length ? `, ${span - days.length} calendar days have no rows and are not counted as zero` : "") + (status(P.datedShare) !== "checked" ? `, ${pct(1 - P.datedShare)} of included rows have no valid date` : "")});
    P.spikes = spikes;
  } else checks.push({name: "Daily spikes", status: "not_available", detail: days.length ? `needs at least 7 days, the file has ${days.length}` : "no valid dates in the file"});

  // 2. model price scenarios (Claude older versions)
  const named = items.filter(x => x.price);
  const modelCover = share(named);
  const byModel = new Map();
  for (const x of named) { const e = byModel.get(x.price.id) || {p: x.price, cost: 0, byKind: {}}; e.cost += x.cost; e.byKind[x.kind || "all"] = (e.byKind[x.kind || "all"] || 0) + x.cost; byModel.set(x.price.id, e); }
  for (const [id, e] of byModel) {
    const to = SUCCESSOR[id] && byId(SUCCESSOR[id]); if (!to) continue;
    const tf = e.p.tok === "old" && to.tok === "new" ? TOKENIZER_FACTOR : 1;
    const ratio = {input: to.i / e.p.i, output: to.o / e.p.o, cached: to.cr / e.p.cr, cw: to.cw5 / e.p.cw5, cw1h: to.cw1h / e.p.cw1h, all: (to.i / e.p.i + to.o / e.p.o) / 2};
    let after = 0; for (const [k, v] of Object.entries(e.byKind)) after += v * (ratio[k] ?? ratio.all) * tf;
    const diff = e.cost - after;
    if (diff / e.cost < 0.05 || diff < 1) continue;
    scenarios.push({type: "scenario", amt: diff, unit: "lower at list prices, estimate",
      title: `${e.p.label} at ${to.label} prices: about ${fmt(diff)} less`,
      note: `The included reported or estimated cost for ${e.p.label} is ${fmt(e.cost)}. Applying the price ratios gives a scenario cost of about ${fmt(after)}` +
        (tf > 1 ? `, assuming ${to.label} uses about 30% more tokens for the same text (Anthropic's note on its newer tokenizer).` : ".") +
        ` Output length, cache use and quality on your tasks can change this either way.`,
      next: `Run a sample of your real prompts on ${to.label} and compare quality and token counts before switching.`});
  }
  checks.push({name: "Model price scenarios", status: status(modelCover), detail: status(modelCover) !== "checked" ? `${pct(modelCover)} of included spend is on models in our price list` : "all included spend is on models in our price list"});

  // 3. cache share (tokens where known; otherwise cost converted to tokens with each model's own rates)
  let full = 0, fromCache = 0, fullCost = 0, cacheCovered = [], inferredCache = false;
  const costGroups = new Map();
  const groupKey = x => JSON.stringify([x.day, x.price?.id, x.tier]);
  for (const x of items) if (x.price && x.source === "reported" && !x.invalidTokens && x.tier !== "unsupported" && x.tier !== "priority") {
    const key = groupKey(x), kinds = costGroups.get(key) || new Set(); kinds.add(x.kind); costGroups.set(key, kinds);
  }
  for (const x of items) {
    if (x.invalidTokens) continue;
    const mult0 = x.tier === "batch" || x.tier === "flex" ? 0.5 : 1;
    if (Number.isFinite(x.T.uncached) && Number.isFinite(x.T.cached)) {
      full += x.T.uncached + x.T.cw5 + x.T.cw1h; fromCache += x.T.cached; cacheCovered.push(x);
      if (x.price) fullCost += x.T.uncached * x.price.i / 1e6 * mult0;
    }
    else if (x.source === "reported" && x.price && costGroups.get(groupKey(x))?.has("input") && costGroups.get(groupKey(x))?.has("cached") && ["input", "cached", "cw", "cw1h", "output"].includes(x.kind)) {
      inferredCache = true;
      const p = x.price, mult = x.tier === "batch" || x.tier === "flex" ? 0.5 : 1;
      if (x.kind === "input") { full += x.cost / mult / p.i * 1e6; fullCost += x.cost; }
      else if (x.kind === "cw") full += x.cost / mult / (p.cw5 ?? p.cw) * 1e6;
      else if (x.kind === "cw1h") full += x.cost / mult / (p.cw1h ?? p.cw) * 1e6;
      else if (x.kind === "cached") fromCache += x.cost / mult / p.cr * 1e6;
      cacheCovered.push(x);
    }
  }
  // a cost export only covers cache if it breaks spend down by token type
  const cacheCover = share(cacheCovered);
  if (cacheCover > 0 && full + fromCache > 0) {
    const cs = fromCache / (full + fromCache);
    const inputCost = fullCost;
    P.cacheShare = cs;
    checks.push({name: "Cache share", status: status(cacheCover), detail: `${pct(cs)} of covered input tokens ${inferredCache ? "estimated from per-model input and cache line-item rates" : "were read from cache"}` + (status(cacheCover) !== "checked" ? `, based on ${pct(cacheCover)} of included spend` : "")});
    if (cs < 0.5 && cacheCover >= 0.5) findings.push({type: "cache", amt: inputCost || null, unit: inputCost ? "uncached input at list prices" : "",
      title: `${inferredCache ? "Estimated: " : ""}${pct(cs)} of covered input tokens came from cache`,
      note: `Cached input is billed at a fraction of the normal input rate (for example $0.20 instead of $4 per million for Claude Opus 5.5).` + (inferredCache ? " This ratio is inferred from list prices; billing adjustments can change it." : "") + (status(cacheCover) !== "checked" ? ` Based on ${pct(cacheCover)} of included spend.` : ""),
      next: "Check whether your requests repeat a long prefix such as a system prompt, tool definitions or shared documents. If they do, prompt caching can bill it at the cache rate."});
  } else checks.push({name: "Cache share", status: "not_available", detail: "needs valid input and cached token counts, or both input and cache cost lines for the same model, day and tier"});

  // 4. batch share
  const tiered = items.filter(x => ["standard", "batch", "flex", "priority"].includes(x.tier));
  const tierCover = share(tiered);
  if (tierCover > 0) {
    const bs = costOf(tiered.filter(x => x.tier === "batch" || x.tier === "flex")) / Math.max(costOf(tiered), 1e-9);
    P.batchShare = bs;
    checks.push({name: "Batch share", status: status(tierCover), detail: `${pct(bs)} of covered spend at batch or flex prices` + (status(tierCover) !== "checked" ? `, based on ${pct(tierCover)} of included spend` : "")});
    if (bs < 0.05 && total > 50 && tierCover >= 0.5) findings.push({type: "batch", amt: null, unit: "",
      title: `${pct(bs)} of covered spend used batch or flex pricing`,
      note: "Eligible Batch API jobs are billed at half standard price when results can wait up to 24 hours. Check model and service eligibility." + (status(tierCover) !== "checked" ? ` Based on ${pct(tierCover)} of included spend.` : ""),
      next: "List jobs that do not need an instant answer, such as evals, backfills and nightly runs, and check whether they can go through the Batch API."});
  } else checks.push({name: "Batch share", status: "not_available", detail: "not available in this export (no batch or service tier column)"});

  // 5. top-tier share
  if (modelCover > 0) {
    const prem = costOf(named.filter(x => PREMIUM.test(x.price.id))) / Math.max(costOf(named), 1e-9);
    checks.push({name: "Top-tier model share", status: status(modelCover), detail: `${pct(prem)} of priced spend on top-tier models`});
    if (prem > 0.6 && modelCover >= 0.5) findings.push({type: "premium", amt: costOf(named.filter(x => PREMIUM.test(x.price.id))), unit: "on top-tier models",
      title: `${pct(prem)} of covered spend went to top-tier models`,
      note: "Top-tier models cost several times more than smaller ones of the same family.",
      next: "Pick a few simple call types, such as classification, extraction or short rewrites, and test them on a smaller model."});
  } else checks.push({name: "Top-tier model share", status: "not_available", detail: "no model names we can price"});
  return {findings, scenarios, checks};
}

// ---------------------------------------------------------------- formatting
function fmt(n) {
  if (!Number.isFinite(n)) return "unknown";
  const a = Math.abs(n), s = n < 0 ? "-$" : "$";
  if (a >= 100) return s + Math.round(a).toLocaleString("en-US");
  if (a > 0 && a < 0.01) return (n < 0 ? "-" : "") + "<$0.01";
  return s + a.toFixed(2);
}
function pct(n) { if (n > 0 && n < 0.01) return "<1%"; if (n < 1 && n > 0.99) return ">99%"; return Math.round(n * 100) + "%"; }

// ---------------------------------------------------------------- demo data (also the downloadable sample CSV)
function demoCSV() {
  let s = "date,model,service_tier,uncached_input_tokens,cache_read_input_tokens,output_tokens,cost_usd\n", seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, start = Date.UTC(2026, 7, 1);
  const models = [["claude-opus-4-1", 8.4e6, 0.6e6, 0.8e6], ["claude-sonnet-5", 51e6, 9e6, 5e6], ["claude-haiku-4-5", 40e6, 12e6, 3e6]];
  for (let d = 0; d < 31; d++) {
    const t = start + d * 864e5, day = new Date(t).toISOString().slice(0, 10), wk = [0, 6].includes(new Date(t).getUTCDay()) ? 0.55 : 1;
    for (const [m, i0, c0, o0] of models) {
      const p = findPrice(m), k = wk * (d === 17 && m === "claude-sonnet-5" ? 8 : 1) * (0.85 + rnd() * 0.3);
      const i = Math.round(i0 * k), c = Math.round(c0 * k), o = Math.round(o0 * k);
      s += `${day},${m},standard,${i},${c},${o},${((i * p.i + c * p.cr + o * p.o) / 1e6).toFixed(2)}\n`;
    }
  }
  return s;
}

const API = {PRICES_CHECKED, SOURCES, PRICE_LIST, SUCCESSOR, TOKENIZER_FACTOR, findPrice, parseCSV, toDay, cleanModel, detect, analyse, fmt, pct, demoCSV};
if (typeof module !== "undefined" && module.exports) module.exports = API; else root.ASD = API;
})(typeof window !== "undefined" ? window : globalThis);
