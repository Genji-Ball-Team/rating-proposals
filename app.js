// Rating proposals: one page, data.json made by .scratch/placement/site.ts (the same replay as the analysis).
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
  const vs = data.variants, RECOMMENDED = data.recommended;
  const today = vs[0];
  const counts = (v) => tiersHigh.map((t, i) => v.board.filter(([, d]) => d >= t.threshold && d < (tiersHigh[i - 1]?.threshold ?? Infinity)).length);
  const pct = (n) => Math.round((100 * n) / data.slices.test[1]);
  const when = new Date(data.lastMatch).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  $("lede").textContent = `Every EU ranked match since launch on 5 October, up to ${when} (${data.matches} matches; the imported legacy logs are left out), replayed under each proposed rating change. Pick one to see its tiers and leaderboard. ★ is the recommended one.`;
  $("method").innerHTML = `How it's scored: each proposal replays the same matches in order. "Prediction" is how well the ratings before a round predict its finishing order (higher is better). The rounds are split by time into three parts: each system's settings were tuned on rounds ${pct(data.slices.train[0])}–${pct(data.slices.train[1])}%, the systems were compared on ${pct(data.slices.val[0])}–${pct(data.slices.val[1])}% ("choice"), and the scores shown are on the newest ${100 - pct(data.slices.test[0])}%, which neither step used. "Pairs right" is the share of every two players in a round that the ratings put in the right order (50% is a coin flip), so a big lobby counts for more pairs. "Places off" is how many places the predicted finish is off, as a share of what a random guess would be off (lower is better). The range is the 95% range of the difference from today; all above zero means reliably better. One caveat: earlier rounds of this analysis looked at the newest rounds too, so the clean check is a replay of the matches played after ${when}. Ratings are shown so a new player starts at 1000; for the new systems and the anchored start the median regular (50+ rounds) is about 1560, so the tiers are set by that choice, not by the system. Players with 3+ rated rounds are shown.`;

  $("picker").innerHTML = vs.map((v) => `<li><a href="#${v.key}" data-k="${v.key}" class="${v.key === RECOMMENDED ? "rec" : ""}">${esc(v.title)}</a></li>`).join("");

  $("all").innerHTML =
    `<thead><tr><th>Proposal</th>${tiersHigh.map((t) => `<th>${chip(t)}</th>`).join("")}<th>#1</th><th>Median regular</th><th>Choice</th><th>Prediction</th><th>Pairs right</th><th>Places off</th></tr></thead><tbody>` +
    vs.map((v) => `<tr data-k="${v.key}"><td>${esc(v.title)}${v.key === RECOMMENDED ? " ★" : ""}<small class="muted"> · ${esc(v.group)}</small></td>${counts(v).map((c) => `<td class="num${c ? "" : " zero"}">${c}</td>`).join("")}<td class="num">${v.board[0][1]}</td><td class="num">${v.regMedian}</td><td class="num muted">${v.val.toFixed(3)}</td><td class="num ${v.pred > today.pred ? "up" : v.pred < today.pred ? "down" : ""}">${v.pred.toFixed(3)}</td><td class="num ${v.pairs > today.pairs ? "up" : v.pairs < today.pairs ? "down" : ""}">${v.pairs}%</td><td class="num ${v.off < today.off ? "up" : v.off > today.off ? "down" : ""}">${v.off}%</td></tr>`).join("") +
    "</tbody>";
  $("all").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-k]"); if (tr) location.hash = tr.dataset.k; });

  let current = today;
  function render() {
    const key = decodeURIComponent(location.hash.slice(1)) || RECOMMENDED;
    const v = vs.find((x) => x.key === key) ?? vs.find((x) => x.key === RECOMMENDED);
    current = v;
    document.querySelectorAll("[data-k]").forEach((el) => el.toggleAttribute("aria-current", el.dataset.k === v.key));
    $("v-title").textContent = `${v.title}${v.key === RECOMMENDED ? " (recommended)" : ""}`;
    $("v-desc").textContent = v.desc;
    const diff = (a, b, d = 3) => (a === b ? "same as today" : `${a > b ? "+" : ""}${(a - b).toFixed(d)} vs today`);
    const fig = (label, value, small = "") => `<div><dt>${label}</dt><dd class="num">${value}${small ? `<small>${small}</small>` : ""}</dd></div>`;
    $("figures").innerHTML = [
      fig("Prediction, all rounds", v.pred.toFixed(3), v.predCI ? `${diff(v.pred, today.pred)} · range ${v.predCI}` : "the baseline"),
      ...(v.predF ? [fig("vs anchored start", v.predF, "95% range of the prediction difference")] : []),
      fig("Prediction, regulars only", v.reg.toFixed(3), v.regCI ? `${diff(v.reg, today.reg)} · range ${v.regCI}` : "the baseline"),
      fig("Pairs ordered right", `${v.pairs}%`, v.pairsCI ? `range ${v.pairsCI} points vs today` : "of every two players in a round"),
      fig("Regulars' pairs ordered right", `${v.pairsReg}%`, v.pairsRegCI ? `range ${v.pairsRegCI} points vs today` : "rounds where everyone has 20+ rounds"),
      fig("Places off", `${v.off}%`, v.offCI ? `of a random guess · range ${v.offCI} points vs today` : "of a random guess (lower is better)"),
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
