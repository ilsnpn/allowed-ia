/* ==========================================================
   INTERFACE
   Reprise de la carte locale (globe 3D + planisphere), branchee
   sur le moteur de test du navigateur au lieu du fichier
   results.js ecrit par le .bat.
   ========================================================== */

const COLORS = {
  OPEN:     "#19e68c",
  FILTERED: "#ff3355",
  BLOCKED:  "#8e1b30",   // plus sombre que "filtre" : rien n'est passe du tout
  TESTING:  "#39d0ff",
  UNKNOWN:  "#5a7a8a",
};
const SHORT = {
  OPEN: "OUVERT", FILTERED: "FILTRE", BLOCKED: "COUPE",
  TESTING: "TEST", UNKNOWN: "—",
};
const CSS_CLASS = {
  OPEN: "ok", FILTERED: "ko", BLOCKED: "ko",
  TESTING: "test", UNKNOWN: "off",
};
const CONF_MARK = { haute: "●●●", moyenne: "●●", faible: "●" };

const $ = id => document.getElementById(id);
const listEl = $("list"), tsEl = $("ts"), curEl = $("cur"), footEl = $("foot");
const introEl = $("intro"), scoreEl = $("score"), panelEl = $("panel"), tipEl = $("tip");

let snap = {
  results: {}, current: null, calibrated: false, running: false, pass: 0,
  summary: { OPEN:0, FILTERED:0, BLOCKED:0, UNKNOWN: TARGETS.length, total: TARGETS.length },
};
let world = null;
let showLogos = false;

function stateOf(name){
  const r = snap.results[name];
  return r ? r.state : "UNKNOWN";
}
function colorOf(name){ return COLORS[stateOf(name)] || COLORS.UNKNOWN; }
function hexToRgba(hex, a){
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

/* ==========================================================
   MOTEUR
   ========================================================== */
const engine = new ProbeEngine({
  targets: TARGETS,
  controls: CONTROLS,
  onUpdate: s => { snap = s; render(); },
  onTarget: name => { if (world) fireShot(name); },
});

/* ==========================================================
   GLOBE 3D
   ========================================================== */
function initGlobe(){
  if (typeof Globe === "undefined"){
    document.querySelector(".intro .note").innerHTML =
      "<b>Affichage 3D indisponible.</b> La librairie n'a pas pu etre chargee. " +
      "Le test fonctionne quand meme : les resultats s'affichent dans la liste.";
    return;
  }

  world = Globe()(document.getElementById("globe"))
    .globeImageUrl("assets/earth-night.jpg")
    .backgroundImageUrl("assets/night-sky.png")
    .atmosphereColor("#1c5f8a")
    .atmosphereAltitude(0.18)
    .pointOfView({ lat: 45, lng: -30, altitude: 2.1 })

    .pointsData([HOME, ...TARGETS])
    .pointLat("lat").pointLng("lng")
    .pointColor(d => d === HOME ? "#39d0ff" : colorOf(d.name))
    .pointAltitude(0.012)
    .pointRadius(0.35)

    .labelsData([HOME, ...TARGETS])
    .labelLat("lat").labelLng("lng")
    .labelText("name")
    .labelSize(0.85)
    .labelDotRadius(0)
    .labelColor(d => d === HOME ? "#39d0ff" : hexToRgba(colorOf(d.name), 0.9))
    .labelAltitude(0.015)

    // badges de marque : vides tant que le mode logo n'est pas actif
    .htmlElementsData([])
    .htmlLat("lat").htmlLng("lng")
    .htmlAltitude(0.02)
    .htmlElement(d => {
      const el = document.createElement("div");
      el.className = "badge";
      el.style.setProperty("--bg", d.color);
      el.style.setProperty("--dot", colorOf(d.name));
      el.title = d.name;
      el.innerHTML = `<span class="ab">${d.ab}</span><span class="sd"></span>`;
      return el;
    })

    .ringsData(TARGETS)
    .ringLat("lat").ringLng("lng")
    .ringColor(d => t => hexToRgba(colorOf(d.name), Math.max(0, 1 - t)))
    .ringMaxRadius(3.4)
    .ringPropagationSpeed(2.4)
    .ringRepeatPeriod(d => stateOf(d.name) === "OPEN" ? 2600 : 1100)

    // fil permanent : trait fin colore par verdict
    // test en cours : comete blanche vers la cible
    .arcStartLat(() => HOME.lat).arcStartLng(() => HOME.lng)
    .arcEndLat("lat").arcEndLng("lng")
    .arcColor(d => d.shot ? ["#ffffff", colorOf(d.name)] : hexToRgba(colorOf(d.name), 0.28))
    .arcAltitudeAutoScale(0.45)
    .arcStroke(d => d.shot ? 1.5 : 0.12)
    .arcDashLength(d => d.shot ? 0.22 : 1)
    .arcDashGap(d => d.shot ? 1.6 : 0)
    .arcDashInitialGap(d => d.shot ? 1 : 0)
    .arcDashAnimateTime(d => d.shot ? 900 : 0);

  world.controls().autoRotate = true;
  world.controls().autoRotateSpeed = 0.35;
  window.addEventListener("resize", () => world.width(innerWidth).height(innerHeight));
}

function testedTargets(){ return TARGETS.filter(t => {
  const s = stateOf(t.name);
  return s !== "UNKNOWN" && s !== "TESTING";
}); }

function fireShot(name){
  if (!world) return;
  const t = TARGETS.find(x => x.name === name);
  world.arcsData(t ? [...testedTargets(), { ...t, shot: true }] : [...testedTargets()]);
}

function refreshGlobe(){
  if (!world) return;
  world.pointsData([HOME, ...TARGETS]);
  world.labelsData(showLogos ? [HOME] : [HOME, ...TARGETS]);
  world.htmlElementsData(showLogos ? [...TARGETS] : []);  // reference neuve -> redessine les pastilles
  world.ringsData(TARGETS);
}

/* ==========================================================
   PANNEAU + COMPTEURS
   ========================================================== */
function render(){
  const s = snap.summary;
  $("nOpen").textContent  = s.OPEN;
  $("nFilt").textContent  = s.FILTERED;
  $("nBlock").textContent = s.BLOCKED;
  $("nWait").textContent  = s.UNKNOWN;

  listEl.innerHTML = TARGETS.map(t => {
    const r = snap.results[t.name];
    const st = r ? r.state : "UNKNOWN";
    const live = t.name === snap.current ? " live" : "";
    const extra = r && st === "OPEN" ? r.ms + "ms" : "";
    const conf = r && r.confidence && st !== "TESTING" ? CONF_MARK[r.confidence] : "";
    return `<div class="prow ${CSS_CLASS[st]}${live}" data-n="${t.name}">
      <span class="dot"></span>
      <span class="n">${t.name}</span>
      <span class="s">${SHORT[st]} ${extra}</span>
      <span class="c" title="niveau de confiance">${conf}</span>
    </div>`;
  }).join("");

  if (snap.calibrated){
    footEl.innerHTML =
      `reseau de reference : <b>${snap.baselineMs} ms</b><br>` +
      `verification du contenu : <b>${snap.contentTrusted ? "active" : "indisponible"}</b>` +
      (snap.pass > 1 ? `<br>tour n° <b>${snap.pass}</b>` : "");
  }

  if (snap.current){
    curEl.innerHTML = "en cours : <b>" + snap.current + "</b>";
  } else if (snap.calibrated && !snap.running){
    curEl.innerHTML = "test arrete";
  }

  if (snap.calibrated){
    const done = s.total - s.UNKNOWN;
    tsEl.innerHTML = `<b>${done}</b> / ${s.total} services mesures`;
  }

  refreshGlobe();
}

/* détail au survol d'une ligne (bureau uniquement) */
listEl.addEventListener("mouseover", e => {
  const row = e.target.closest(".prow");
  if (!row) return;
  const r = snap.results[row.dataset.n];
  const t = TARGETS.find(x => x.name === row.dataset.n);
  if (!r || r.state === "TESTING"){ tipEl.classList.add("hidden"); return; }

  tipEl.innerHTML =
    `<div class="t">${t.name} — ${SHORT[r.state]}</div>
     <div class="w">${r.why}</div>
     <div class="kv"><span>confiance</span><span>${r.confidence}</span></div>
     <div class="kv"><span>delai</span><span>${r.ms} ms</span></div>
     <div class="kv"><span>paquet sorti</span><span>${r.netReached ? "oui" : "non"}</span></div>
     <div class="kv"><span>contenu authentique</span><span>${
        snap.contentTrusted ? (r.contentDecoded ? "oui" : "non") : "non verifiable"}</span></div>
     ${r.flips ? `<div class="kv"><span>changements</span><span>${r.flips}</span></div>` : ""}`;
  tipEl.classList.remove("hidden");

  const b = row.getBoundingClientRect();
  tipEl.style.top = Math.min(b.top, innerHeight - tipEl.offsetHeight - 12) + "px";
  tipEl.style.left = Math.max(12, b.left - tipEl.offsetWidth - 12) + "px";
});
listEl.addEventListener("mouseleave", () => tipEl.classList.add("hidden"));

/* ==========================================================
   PLANISPHERE 2D (canvas, projection equirectangulaire)
   ========================================================== */
const flat = $("flat");
const ctx = flat.getContext("2d");
let flatMode = false, W = 0, H = 0, animT = 0;

const view = { scale: 1, ox: 0, oy: 0 };
const MIN_SCALE = 1, MAX_SCALE = 12;

const earthImg = new Image();
let earthReady = false;
earthImg.onload = () => { earthReady = true; };
earthImg.src = "assets/earth-night.jpg";

function baseX(lng){ return (lng + 180) / 360 * W; }
function baseY(lat){ return (90 - lat) / 180 * H; }
function projX(lng){ return baseX(lng) * view.scale + view.ox; }
function projY(lat){ return baseY(lat) * view.scale + view.oy; }

function clampView(){
  view.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale));
  view.ox = Math.max(W - W * view.scale, Math.min(0, view.ox));
  view.oy = Math.max(H - H * view.scale, Math.min(0, view.oy));
}

function resizeFlat(){
  const dpr = window.devicePixelRatio || 1;
  W = innerWidth; H = innerHeight;
  flat.width = W * dpr; flat.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  clampView();
}
window.addEventListener("resize", () => { if (flatMode) resizeFlat(); });

function drawFlat(){
  if (!flatMode) return;
  animT += 0.016;
  ctx.clearRect(0, 0, W, H);

  if (earthReady){
    ctx.drawImage(earthImg, view.ox, view.oy, W * view.scale, H * view.scale);
    ctx.fillStyle = "rgba(2,10,16,.35)";   // voile sombre : fait ressortir les traits
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = "#04121a"; ctx.fillRect(0, 0, W, H);
  }

  ctx.strokeStyle = "rgba(57,208,255,.08)"; ctx.lineWidth = 1;
  for (let lng = -150; lng <= 150; lng += 30){
    const x = projX(lng); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30){
    const y = projY(lat); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  const hx = projX(HOME.lng), hy = projY(HOME.lat);

  testedTargets().forEach(t =>
    drawArc2D(hx, hy, projX(t.lng), projY(t.lat), hexToRgba(colorOf(t.name), 0.25), 1, false));

  const live = TARGETS.find(t => t.name === snap.current);
  if (live) drawArc2D(hx, hy, projX(live.lng), projY(live.lat), colorOf(live.name), 2.5, true);

  TARGETS.forEach(drawNode2D);

  ctx.fillStyle = "#39d0ff";
  ctx.beginPath(); ctx.arc(hx, hy, 5, 0, 7); ctx.fill();
  ctx.strokeStyle = "rgba(57,208,255,.5)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(hx, hy, 5 + (animT * 20 % 18), 0, 7); ctx.stroke();
  ctx.fillStyle = "#39d0ff"; ctx.font = "700 11px ui-monospace,monospace";
  ctx.textAlign = "center"; ctx.fillText(HOME.name, hx, hy - 12);

  requestAnimationFrame(drawFlat);
}

function drawArc2D(x1, y1, x2, y2, color, width, animated){
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.22;
  ctx.strokeStyle = color; ctx.lineWidth = width;
  if (animated){
    ctx.setLineDash([10, 14]); ctx.lineDashOffset = -animT * 90;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
  } else { ctx.setLineDash([]); ctx.shadowBlur = 0; }
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
  ctx.setLineDash([]); ctx.shadowBlur = 0;

  if (animated){
    const p = (animT * 0.5) % 1;
    const bx = (1-p)*(1-p)*x1 + 2*(1-p)*p*mx + p*p*x2;
    const by = (1-p)*(1-p)*y1 + 2*(1-p)*p*my + p*p*y2;
    ctx.fillStyle = "#fff"; ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(bx, by, 3, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  }
}

function drawNode2D(t){
  const x = projX(t.lng), y = projY(t.lat);
  const col = colorOf(t.name);

  if (t.name === snap.current){
    const r = 6 + (animT * 30 % 22);
    ctx.strokeStyle = hexToRgba(col, Math.max(0, 1 - (r - 6) / 22));
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  }

  if (showLogos){
    ctx.fillStyle = t.color;
    ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "700 9px ui-monospace,monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(t.ab, x, y + 0.5);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x + 8, y + 8, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = "#04141b"; ctx.lineWidth = 1.5; ctx.stroke();
  } else {
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = hexToRgba(col, 0.95);
    ctx.font = "600 10px ui-monospace,monospace"; ctx.textAlign = "center";
    ctx.fillText(t.name, x, y - 9);
  }
}

/* zoom molette + deplacement au doigt/souris */
flat.addEventListener("wheel", e => {
  e.preventDefault();
  const rect = flat.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const wx = (mx - view.ox) / view.scale, wy = (my - view.oy) / view.scale;
  view.scale *= e.deltaY < 0 ? 1.15 : 1 / 1.15;
  clampView();
  view.ox = mx - wx * view.scale;
  view.oy = my - wy * view.scale;
  clampView();
}, { passive: false });

let dragging = false, dragX = 0, dragY = 0;
flat.addEventListener("pointerdown", e => {
  dragging = true; dragX = e.clientX; dragY = e.clientY;
  flat.setPointerCapture(e.pointerId); flat.style.cursor = "grabbing";
});
flat.addEventListener("pointermove", e => {
  if (!dragging) return;
  view.ox += e.clientX - dragX; view.oy += e.clientY - dragY;
  dragX = e.clientX; dragY = e.clientY;
  clampView();
});
const endDrag = () => { dragging = false; flat.style.cursor = "grab"; };
flat.addEventListener("pointerup", endDrag);
flat.addEventListener("pointercancel", endDrag);
flat.style.cursor = "grab";
flat.addEventListener("dblclick", () => { view.scale = 1; view.ox = 0; view.oy = 0; });

/* ==========================================================
   COMMANDES
   ========================================================== */
const runBtn = $("runBtn");

async function startTest(){
  introEl.classList.add("hidden");
  scoreEl.classList.remove("hidden");
  runBtn.innerHTML = "&#9633; ARRETER";
  runBtn.classList.remove("go");
  runBtn.classList.add("stop");
  tsEl.textContent = "CALIBRATION DU RESEAU...";
  await engine.start({ loop: true });
  runBtn.innerHTML = "&#9655; RELANCER";
  runBtn.classList.add("go");
  runBtn.classList.remove("stop");
}
function toggleRun(){
  if (engine.running){ engine.stop(); } else { startTest(); }
}
runBtn.addEventListener("click", toggleRun);
$("startBtn").addEventListener("click", startTest);

$("howLink").addEventListener("click", e => {
  e.preventDefault();
  introEl.classList.remove("hidden");
});

/* releve texte, a coller dans un ticket au service informatique */
$("copyBtn").addEventListener("click", async () => {
  const txt = engine.report();
  const btn = $("copyBtn");
  try {
    await navigator.clipboard.writeText(txt);
    btn.innerHTML = "&#10003; COPIE";
  } catch {
    // navigateur qui refuse le presse-papiers : on ouvre le texte
    const w = window.open("", "_blank");
    if (w){ w.document.write("<pre>" + txt.replace(/</g, "&lt;") + "</pre>"); }
    btn.innerHTML = "&#10003; OUVERT";
  }
  setTimeout(() => { btn.innerHTML = "&#128203; RELEVE"; }, 1800);
});

function toggleFs(){
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}
$("fsBtn").addEventListener("click", toggleFs);
document.addEventListener("fullscreenchange", () => {
  $("fsBtn").innerHTML = document.fullscreenElement ? "&#x26F6; QUITTER" : "&#x26F6; PLEIN ECRAN";
  if (world) world.width(innerWidth).height(innerHeight);
});

function toggleLogos(){
  showLogos = !showLogos;
  $("logoBtn").innerHTML = showLogos ? "&#x25C9; NOMS" : "&#x25C9; LOGOS";
  refreshGlobe();
}
$("logoBtn").addEventListener("click", toggleLogos);

function toggleMap(){
  flatMode = !flatMode;
  $("mapBtn").innerHTML = flatMode ? "&#x1F30D; GLOBE 3D" : "&#x1F5FA; PLANISPHERE";
  $("globe").classList.toggle("hidden", flatMode);
  flat.classList.toggle("hidden", !flatMode);
  if (flatMode){ resizeFlat(); drawFlat(); }
}
$("mapBtn").addEventListener("click", toggleMap);

$("drawerBtn").addEventListener("click", () => panelEl.classList.toggle("open"));

document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT") return;
  const k = e.key.toLowerCase();
  if (k === "f") toggleFs();
  if (k === "l") toggleLogos();
  if (k === "m") toggleMap();
  if (k === " "){ e.preventDefault(); toggleRun(); }
});

/* ---------- demarrage ---------- */
initGlobe();
render();
