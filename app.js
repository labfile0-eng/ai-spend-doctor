(() => {
"use strict";
const {analyse, fmt, pct, demoCSV, PRICES_CHECKED} = window.ASD;
const PUBLIC_URL = "https://aispenddoctor.com/";
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
$("checked").textContent = PRICES_CHECKED;
let LAST = null; // {text, name, demo, unit}

// ---------------------------------------------------------------- views
function showStart(focus) {
  $("result").hidden = true; $("start").hidden = false;
  if (focus) { $("start").scrollIntoView({behavior: smooth(), block: "start"}); $("drop").focus({preventScroll: true}); }
}
const smooth = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
function route() {
  const h = location.hash;
  if (h === "#demo") run(demoCSV(), "demo", true);
  else if (h === "#result" && LAST) run(LAST.text, LAST.name, LAST.demo, LAST.unit);
  else if (h === "#start") showStart(true);
  else if (!h) showStart(false);
}
window.addEventListener("hashchange", route);
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-start], a[data-demo]");
  if (!a) return;
  const want = a.hasAttribute("data-demo") ? "#demo" : "#start";
  if (location.hash === want) { e.preventDefault(); route(); } // same hash: hashchange would not fire
});

// ---------------------------------------------------------------- file input
const drop = $("drop"), file = $("file");
drop.onclick = () => file.click();
drop.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } };
["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) read(f); });
file.onchange = () => { if (file.files[0]) read(file.files[0]); file.value = ""; };
function read(f) {
  if (f.size > 50e6) return setStatus("This file is over 50 MB. Export one month at a time.", true);
  setStatus("Reading " + f.name + "…");
  const r = new FileReader();
  r.onload = () => { if (run(String(r.result), f.name, false)) history.pushState(null, "", "#result"); };
  r.onerror = () => setStatus("The browser could not read this file. Export it again as CSV and try once more.", true);
  r.readAsText(f);
}
function setStatus(msg, err) { $("status").textContent = msg; $("status").classList.toggle("err", !!err); }
$("dl").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([demoCSV()], {type: "text/csv"}));
  a.download = "ai-spend-doctor-demo.csv"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
const tabs = [["tabA", "howA"], ["tabO", "howO"], ["tabR", "howR"]];
tabs.forEach(([t, p]) => $(t).onclick = () => tabs.forEach(([t2, p2]) => { $(t2).setAttribute("aria-selected", t2 === t); $(p2).hidden = p2 !== p; }));

// ---------------------------------------------------------------- errors
function errorText(P) {
  const cols = P.header.slice(0, 8).map(h => `"${h}"`).join(", ");
  switch (P.error) {
    case "malformed-csv": return "The CSV has an unclosed quoted field. Export the file again or close the quote before checking it.";
    case "invalid-values": return "No valid cost rows remain. Check the column count, numeric costs, and nonnegative whole token counts. Invalid values were not replaced with zero.";
    case "empty": return "This file is empty.";
    case "header-only": return "The file has column names but no rows. Export a period that had usage.";
    case "no-columns": return `We found no cost column and no token counts. Columns in the file: ${cols}. The file needs a cost column (for example cost_usd or amount) or token columns (input_tokens, output_tokens) with a model name. See supported formats below.`;
    case "all-unpriced": return `The token rows could not be priced. A known model, valid input and output counts, and a supported service tier are required. Affected models: ${P.unpricedModels.map(m => m[0]).slice(0, 4).join(", ")}. Use a cost export for actual billed amounts.`;
    case "other-currency": return `All amounts are in ${P.currencies.map(c => c[0]).join(", ")}. This version reads US dollars only.`;
    case "only-credits": return "The file only has credits or refunds, no spend.";
    default: return "No row had a cost or token count we could read. Check that you exported the usage or cost report as CSV.";
  }
}

// ---------------------------------------------------------------- result
function run(text, name, demo, unit) {
  const P = analyse(text, {unit});
  if (P.error) { showStart(false); setStatus(errorText(P), true); $("where").open = P.error === "no-columns"; return false; }
  setStatus("");
  LAST = {text, name, demo, unit};
  render(P, demo);
  return true;
}
function render(P, demo) {
  const R = P.checks, nF = R.findings.length;
  const period = P.days.length ? `${P.days[0]} to ${P.days.at(-1)}${P.datedShare < 1 ? " (dated rows only; total also includes undated rows)" : ""}` : "no valid dates in the file";
  const tag = demo ? '<span class="demo-tag">Demo: synthetic data</span>' : "";
  const cost = P.reported && P.estimated ? `Reported cost <b>${fmt(P.reported)}</b> plus <b>${fmt(P.estimated)}</b> estimated from token counts`
    : P.reported || !P.estimated ? `Reported cost <b>${fmt(P.reported)}</b>` : `Estimated cost <b>${fmt(P.estimated)}</b>, calculated from token counts and list prices`;
  const na = R.checks.filter(c => c.status === "not_available").length, part = R.checks.filter(c => c.status === "partially_checked").length;
  const excluded = P.counts.unpriced + P.counts.currency + P.counts.invalid + P.counts.noData;
  let h = `${tag}<span class="label">Checkup result</span>
    <h2>${nF ? `${nF} item${nF > 1 ? "s" : ""} to investigate` : "No patterns flagged in the available data"}</h2>
    <p>${cost}, ${esc(period)}.</p>`;
  if (excluded) h += `<p class="per">${excluded} row${excluded > 1 ? "s" : ""} without a usable cost ${excluded > 1 ? "are" : "is"} not in this total. See what we read.</p>`;
  if (na || part) h += `<p class="per">${na ? `${na} of ${R.checks.length} checks could not run on this file` : ""}${na && part ? ", " : ""}${part ? `${part} ran on part of it` : ""}.</p>`;
  $("verdict").className = "verdict " + (nF ? "warn" : "neutral"); $("verdict").innerHTML = h;

  // units
  const u = $("units");
  if (P.unitReason && P.unitReason !== "header" && P.unitReason !== "openai-costs") {
    const why = {"anthropic-cost-api": "in cents, as in the Anthropic Cost API", assumed: "as US dollars", user: `as ${P.unit === "cents" ? "cents" : "US dollars"}, as you chose`}[P.unitReason];
    const other = P.unit === "cents" ? "usd" : "cents";
    u.innerHTML = `We read the column "${esc(P.unitHeader)}" ${why}. <button class="linkbtn" type="button" id="unitSwitch">They are ${other === "usd" ? "dollars" : "cents"}</button>`;
    u.hidden = false;
    $("unitSwitch").onclick = () => { LAST.unit = other; run(LAST.text, LAST.name, LAST.demo, other); };
  } else u.hidden = true;

  // coverage
  const C = P.counts, li = [];
  li.push(`<b>${P.rows}</b> row${P.rows === 1 ? "" : "s"} read, <b>${C.used}</b> used: ${C.reported} with a reported cost, ${C.estimated} estimated from tokens.`);
  if (C.unpriced) li.push(`${C.unpriced} token row${C.unpriced === 1 ? "" : "s"} could not be priced because of an unknown model, incomplete input/output counts or an unsupported tier. Affected models: ${esc(P.unpricedModels.map(m => m[0]).slice(0, 5).join(", "))}. Not counted.`);
  if (C.invalid) li.push(`${C.invalid} row${C.invalid === 1 ? "" : "s"} excluded for invalid numeric values, inconsistent token counts or a different number of columns. Invalid data was not treated as zero.`);
  if (C.invalidTokens) li.push(`Invalid token data in ${C.invalidTokens} row${C.invalidTokens === 1 ? "" : "s"}. Explicit reported costs, when valid, are retained; token-derived checks do not use this data.`);
  if (C.currency) li.push(`${C.currency} rows in ${esc(P.currencies.map(c => c[0]).join(", "))} are not counted. This version reads US dollars only.`);
  if (P.byok > 0) li.push(`${fmt(P.byok)} of inference ran on your own provider keys (BYOK). Providers bill that directly, so it is not in this total.`);
  if (C.credit) li.push(`${C.credit} credit or refund rows (${fmt(P.credits)}) are shown separately and not subtracted.`);
  if (C.total) li.push(`${C.total} total rows skipped so nothing is counted twice.`);
  if (C.noData) li.push(`${C.noData} rows had neither a cost nor token counts.`);
  if (C.badDate) li.push(`${C.badDate} rows have a date we could not read. They count in the total but not in the daily chart.`);
  if (P.assumptions.includes("tier-standard") && C.estimated) li.push("Rows without a service tier were estimated at standard prices.");
  if (P.assumptions.includes("cw5")) li.push("Cache writes without a 5-minute or 1-hour split were priced at the 5-minute rate.");
  if (P.assumptions.includes("standard-context") && C.estimated) li.push("Token estimates use short-context list prices, not an invoice. Long context, regional processing and contract adjustments may change billed costs.");
  if (P.assumptions.includes("no-cache-read") && C.estimated) li.push("Token estimates without cache-read counts assume no cache-read discount. This is an assumption, not a measured cache share.");
  li.push(`Period: ${esc(period)}.`);
  const label = {checked: "Checked", partially_checked: "Partly checked", not_available: "Not available"};
  $("coverageBody").innerHTML = `<ul>${li.map(x => `<li>${x}</li>`).join("")}</ul>
    <table class="checks"><thead><tr><th>Check</th><th>Status</th><th>Basis</th></tr></thead><tbody>${R.checks.map(c =>
      `<tr><td>${esc(c.name)}</td><td><span class="chip ${c.status}">${label[c.status]}</span></td><td>${esc(c.detail)}</td></tr>`).join("")}</tbody></table>
    <p class="per">Prices checked ${esc(PRICES_CHECKED)}. <a href="/csv-formats/#method">How we calculate</a></p>`;
  $("coverage").open = !nF || na > 0;

  const card = (f, kind) => `<div class="find ${kind}"><div class="bar"></div><div class="t"><b>${esc(f.title)}</b><span>${esc(f.note)}</span>
      <span class="next"><b>Next step:</b> ${esc(f.next)}</span></div>${f.amt != null ? `<div class="m">${esc(fmt(f.amt))}<small>${esc(f.unit)}</small></div>` : ""}</div>`;
  $("finds").innerHTML = R.findings.map(f => card(f, "check")).join(""); $("findsWrap").hidden = !nF;
  $("scens").innerHTML = R.scenarios.map(f => card(f, "scen")).join(""); $("scenWrap").hidden = !R.scenarios.length;
  chart(P);
  $("own").textContent = demo ? "Check my own CSV" : "Check another file";
  $("copyText").value = copyText(P, demo, period);
  $("copyBox").hidden = true; $("copyOpen").setAttribute("aria-expanded", "false"); $("shared").textContent = "";
  $("result").hidden = false; $("start").hidden = true;
  $("result").scrollIntoView({behavior: smooth(), block: "start"});
}
function copyText(P, demo, period) {
  const R = P.checks, L = [];
  L.push("AI Spend Doctor result" + (demo ? " (Demo: synthetic data, not real spend)" : ""));
  L.push(`Period: ${period}`);
  if (P.reported) L.push(`Reported cost: ${fmt(P.reported)}`);
  if (P.estimated) L.push(`Estimated from token counts: ${fmt(P.estimated)}`);
  if (!P.reported && !P.estimated) L.push("Reported cost: $0.00");
  const C = P.counts;
  L.push(`Coverage: ${C.used} of ${P.rows} rows included (${C.reported} reported, ${C.estimated} estimated).`);
  if (C.unpriced + C.currency + C.invalid + C.noData) L.push("Total is incomplete: unpriced, unsupported, invalid or empty-cost rows were excluded.");
  if (C.credit) L.push(`Credits/refunds excluded from spend: ${fmt(P.credits)}.`);
  if (C.invalidTokens) L.push("Invalid token data was excluded from token-derived checks; valid reported costs were retained.");
  if (P.estimated) L.push("Estimates use list prices and documented assumptions, not verified billing amounts. See https://aispenddoctor.com/csv-formats/#method");
  if (R.findings.length) { L.push("", "Items to investigate:"); R.findings.forEach(f => L.push(`- ${f.title}. Next step: ${f.next}`)); }
  else L.push("", "No patterns flagged in the available data.");
  if (R.scenarios.length) { L.push("", "Model price scenarios (estimates at list prices, not confirmed savings):"); R.scenarios.forEach(f => L.push(`- ${f.title}`)); }
  L.push("", "Checks and coverage:");
  R.checks.forEach(c => L.push(`- ${c.name}: ${c.status.replaceAll("_", " ")}. ${c.detail}`));
  L.push("", `Checked in the browser, the file was not uploaded. ${PUBLIC_URL}`);
  return L.join("\n");
}
function chart(P) {
  const box = $("chart"), days = P.byDay || [];
  if (days.length < 3) { box.hidden = true; return; } box.hidden = false;
  const W = 640, H = 150, pl = 50, pr = 8, pt = 22, pb = 22, vals = days.map(d => d[1]), max = Math.max(...vals) || 1;
  const p = 10 ** Math.floor(Math.log10(max)), step = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10].map(x => x * p).find(x => x >= max / 4), top = Math.ceil(max / step) * step;
  const bw = (W - pl - pr) / vals.length, mono = 'font-family="IBM Plex Mono, monospace" font-size="11" fill="var(--muted)"';
  const spikes = new Set(P.spikes || []);
  let g = `<text x="0" y="12" ${mono}>Spend per day with data</text>`;
  for (let v = 0; v <= top + 1e-9; v += step) { const y = pt + (H - pt - pb) * (1 - v / top);
    g += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end" ${mono}>$${v >= 1000 ? +(v / 1000).toFixed(1) + "k" : +v.toFixed(2)}</text>`; }
  days.forEach(([d, v], i) => { const h = (H - pt - pb) * v / top, sp = spikes.has(d);
    g += `<rect x="${(pl + i * bw + bw * 0.15).toFixed(1)}" y="${(H - pb - h).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${sp ? "var(--warn)" : "var(--accent)"}" opacity="${sp ? 1 : 0.7}"><title>${d}: ${fmt(v)}</title></rect>`; });
  g += `<text x="${pl}" y="${H - 5}" ${mono}>${days[0][0]}</text><text x="${W - pr}" y="${H - 5}" text-anchor="end" ${mono}>${days.at(-1)[0]}</text>`;
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Spend per day, ${days.length} days">${g}</svg>`;
}

// ---------------------------------------------------------------- copy and share
$("copyOpen").onclick = () => { const open = $("copyBox").hidden; $("copyBox").hidden = !open; $("copyOpen").setAttribute("aria-expanded", open); if (open) $("copyText").focus(); };
async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); $("shared").textContent = done; }
  catch { $("shared").textContent = "Copying is blocked here. Select the text and press Ctrl+C or Cmd+C."; }
}
$("copyGo").onclick = () => { $("copyText").select(); copy($("copyText").value, "Copied. Paste it wherever you need it."); };
$("shareTool").onclick = () => copy(PUBLIC_URL, "Link copied. It contains no data from your file.");

route();
})();
