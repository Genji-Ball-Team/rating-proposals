// Rating proposals: one page, data.json made by .scratch/placement/final.ts (the same replay as the analysis).
const INFO = {
  A: ["Today", "The live rating system, unchanged. The baseline every other proposal is compared with."],
  B: ["Trust rule", "Your gain from a round is multiplied by the average trust of the players you beat: 0% for a brand new player, 100% from 20 rounds. Losses stay the same."],
  C: ["Trust rule, regulars only", "The trust rule, but only for players who already have 20+ rounds. Newer players' gains are not cut."],
  D: ["Trust rule, 10 rounds", "The trust rule with full trust at 10 rounds instead of 20."],
  E: ["Trust rule, 40 rounds", "The trust rule with full trust at 40 rounds instead of 20."],
  F: ["Anchored start", "New players start 8 rating units (560 points) below the median regular (50+ rounds). For their first 100 rounds they move up to 2× faster. Under 50 rounds the cap per match is 400 instead of 150. The scale is set so a new player shows 1000."],
  G: ["Anchored start, 10 below", "The anchored start, but new players start 10 units (700 points) below the median regular."],
  H: ["Anchored start + trust rule", "Both: the anchored start and the trust rule (20 rounds)."],
  I: ["Faster newcomers, normal start", "New players move up to 2× faster over their first 100 rounds and have a 400 cap per match under 50 rounds. They start at 1000 like today."],
  J: ["Faster newcomers only", "New players move up to 2× faster over their first 100 rounds. Nothing else changes."],
};
const RECOMMENDED = "F";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (n) => n.toLocaleString("en-US");

function tierStyle(tier) {
  const [r, g, b] = tier.color;
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const light = 1.05 / (lum + 0.05) > (lum + 0.05) / 0.0535;
  return `--tier:rgb(${r},${g},${b});--on-tier:${light ? "#fff" : "var(--bg)"}`;
}
const chip = (t) => `<span class="chip" style="${tierStyle(t)}">${esc(t.label)}</span>`;

fetch("data.json").then((r) => r.json()).then((data) => {
  const tiersHigh = [...data.tiers].reverse();
  const tierOf = (d) => tiersHigh.find((t) => d >= t.threshold);
  const vs = data.variants.map((v) => ({ ...v, key: v.name[0] }));
  const today = vs[0];
  const counts = (v) => tiersHigh.map((t, i) => v.board.filter(([, d]) => d >= t.threshold && d < (tiersHigh[i - 1]?.threshold ?? Infinity)).length);
  const when = new Date(data.lastMatch).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  $("lede").textContent = `Every EU ranked match up to ${when} (${data.matches} matches) replayed under each proposed rating change. Pick one to see its tiers and leaderboard. ★ is the recommended one.`;
  $("method").innerHTML = `How it's scored: each proposal replays the same matches in order. "Prediction" is how well the ratings before a round predict its finishing order, on the newest 40% of rounds (settings picked on older rounds only). The range is the 95% range of the difference from today; if it's all below zero, the proposal is reliably worse. Players with 3+ rated rounds are shown.`;

  $("picker").innerHTML = vs.map((v) => `<li><a href="#${v.key}" data-k="${v.key}" class="${v.key === RECOMMENDED ? "rec" : ""}">${v.key} · ${esc(INFO[v.key][0])}</a></li>`).join("");

  $("all").innerHTML =
    `<thead><tr><th>Proposal</th>${tiersHigh.map((t) => `<th>${chip(t)}</th>`).join("")}<th>#1</th><th>Median regular</th><th>Prediction</th></tr></thead><tbody>` +
    vs.map((v) => `<tr data-k="${v.key}"><td>${v.key} · ${esc(INFO[v.key][0])}${v.key === RECOMMENDED ? " ★" : ""}</td>${counts(v).map((c) => `<td class="num${c ? "" : " zero"}">${c}</td>`).join("")}<td class="num">${v.board[0][1]}</td><td class="num">${v.regMedian}</td><td class="num ${v.pred > today.pred ? "up" : v.pred < today.pred ? "down" : ""}">${v.pred.toFixed(3)}</td></tr>`).join("") +
    "</tbody>";
  $("all").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-k]"); if (tr) location.hash = tr.dataset.k; });

  let current = today;
  function render() {
    const key = (location.hash.slice(1) || RECOMMENDED).toUpperCase();
    const v = vs.find((x) => x.key === key) ?? vs.find((x) => x.key === RECOMMENDED);
    current = v;
    document.querySelectorAll("[data-k]").forEach((el) => el.toggleAttribute("aria-current", el.dataset.k === v.key));
    $("v-title").textContent = `${v.key} · ${INFO[v.key][0]}${v.key === RECOMMENDED ? " (recommended)" : ""}`;
    $("v-desc").textContent = INFO[v.key][1];
    const diff = (a, b, d = 3) => (a === b ? "" : `${a > b ? "+" : ""}${(a - b).toFixed(d)} vs today`);
    const fig = (label, value, small = "") => `<div><dt>${label}</dt><dd class="num">${value}${small ? `<small>${small}</small>` : ""}</dd></div>`;
    $("figures").innerHTML = [
      fig("Prediction, all rounds", v.pred.toFixed(3), v.predCI ? `${diff(v.pred, today.pred)} · range ${v.predCI}` : "the baseline"),
      fig("Prediction, regulars only", v.reg.toFixed(3), v.regCI ? `${diff(v.reg, today.reg)} · range ${v.regCI}` : "the baseline"),
      fig("Top-rated player wins", `${v.hit}%`, "of rounds"),
      fig("#1 rating", v.board[0][1], esc(v.board[0][0])),
      fig("Median regular", v.regMedian, `${v.gapToStart >= 0 ? "+" : ""}${v.gapToStart} vs a new player's start`),
      fig("Regulars' move per match", v.move, "median / 90th percentile"),
      fig("Regulars' net gain from newcomers", fmt(v.feed), "points, rounds with a player under 10 rounds"),
    ].join("");
    const c = counts(v), max = Math.max(...c);
    $("tiers").innerHTML = tiersHigh.map((t, i) => `<li style="${tierStyle(t)}"><span>${chip(t)}</span><span class="count num${c[i] ? "" : " muted"}">${c[i]}</span><span class="track"><span style="width:${max ? (100 * c[i]) / max : 0}%"></span></span></li>`).join("") +
      `<li><span class="muted" style="font-size:.85rem">No tier</span><span class="count num muted">${v.board.filter(([, d]) => d < tiersHigh.at(-1).threshold).length}</span><span></span></li>`;
    drawList();
  }

  function drawList() {
    const q = $("find").value.trim().toLowerCase();
    let html = "", band = null;
    current.board.forEach(([name, d, rounds, wins, delta], i) => {
      if (q && !name.toLowerCase().includes(q)) return;
      const t = tierOf(d);
      const label = t ? t.label : "No tier";
      if (label !== band && !q) {
        band = label;
        const n = current.board.filter(([, x]) => (tierOf(x)?.label ?? "No tier") === label).length;
        html += `<li class="band">${t ? chip(t) : '<span class="chip plain">No tier</span>'}<span class="num">${n} player${n === 1 ? "" : "s"}</span></li>`;
      }
      const pos = i + 1;
      const dl = current === today ? "" : delta === 0 ? '<span class="delta same">–</span>' : `<span class="delta ${delta > 0 ? "up" : "down"}">${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)}</span>`;
      html += `<li class="entry" style="${t ? tierStyle(t) : ""}"><span class="pos num${pos <= 3 ? " high" : ""}${pos === 1 ? " first" : ""}">${pos}</span>` +
        `<span class="who"><b>${esc(name)}</b><small>${fmt(wins)} rounds won</small></span><span class="rating num">${d}</span><span class="num muted">${fmt(rounds)}</span><span>${dl}</span></li>`;
    });
    $("list").innerHTML = html || '<li class="note">No player by that name.</li>';
  }

  $("find").addEventListener("input", drawList);
  addEventListener("hashchange", render);
  render();
});
