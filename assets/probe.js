/* ==========================================================
   MOTEUR DE TEST -- cote navigateur, sans serveur

   CONTRAINTE DE DEPART
   Un navigateur ne peut PAS lire le code HTTP ni le contenu
   d'une reponse venant d'un autre domaine (regle CORS). La
   version .bat le pouvait via curl : elle cherchait "zscaler",
   "access denied"... dans le corps de la page. Ici, impossible.

   TROIS SONDES, ET UNE REGLE D'ASYMETRIE

   1. SONDE RESEAU -- fetch(url, {mode:"no-cors"})
      La reponse est opaque, illisible. Mais la promesse parle :
      elle aboutit si le paquet est passe, elle echoue si le
      reseau a refuse. Signal de connectivite.

   2. SONDE CONTENU -- favicon charge en tant qu'IMAGE
      Si le decodage reussit, l'octet recu est bien une image :
      le vrai serveur a repondu.

      ASYMETRIE, ET C'EST TOUT L'INTERET :
      la reussite prouve quelque chose, l'echec ne prouve RIEN.
      Beaucoup de sites interdisent le chargement de leurs
      images depuis une autre page (en-tete Cross-Origin-
      Resource-Policy: same-origin -- c'est le cas de claude.ai).
      L'image echoue alors meme quand le site est parfaitement
      accessible. Un echec d'image ne peut donc jamais, a lui
      seul, faire conclure a un blocage.

   3. CANARIS -- des domaines qui ne peuvent pas exister
      Le TLD .invalid (RFC 2606) n'est resolu nulle part. Sur un
      reseau honnete ces adresses echouent. Si elles repondent,
      un equipement fabrique des reponses pour tout : le fait
      qu'une requete aboutisse ne prouve alors plus rien, et le
      moteur durcit ses criteres.

   C'est le canari, et non l'echec d'une image, qui autorise un
   verdict negatif.
   ========================================================== */

const STATE = {
  OPEN:     "OPEN",      // le vrai service repond
  PARTIAL:  "PARTIAL",   // certains points d'acces passent, d'autres non
  FILTERED: "FILTERED",  // quelque chose repond a sa place
  BLOCKED:  "BLOCKED",   // rien ne passe
  TESTING:  "TESTING",
  UNKNOWN:  "UNKNOWN",
};

/* Une reponse plus rapide que ce seuil, rapportee a la latence
   de reference, trahit un equipement qui repond en local au
   lieu de laisser sortir le paquet. */
const LOCAL_ANSWER_RATIO = 0.35;
const LOCAL_ANSWER_FLOOR_MS = 25;

/* En dessous de ce delai, un echec vient d'un refus immediat
   (DNS ou reset) et non d'une connexion qui n'aboutit pas. */
const FAST_FAIL_MS = 400;

const CONF_RANK = { faible: 0, moyenne: 1, haute: 2 };

/* ----------------------------------------------------------
   SONDE 1 : la couche reseau laisse-t-elle passer ?
   ---------------------------------------------------------- */
async function probeNetwork(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now(), {
      mode: "no-cors",
      cache: "no-store",
      redirect: "follow",
      credentials: "omit",   // aucun cookie n'est envoye aux cibles
      signal: ctrl.signal,
    });
    return { reached: true, ms: performance.now() - t0, timedOut: false };
  } catch (e) {
    return {
      reached: false,
      ms: performance.now() - t0,
      timedOut: e && e.name === "AbortError",
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ----------------------------------------------------------
   SONDE 2 : l'octet recu est-il bien une image du vrai site ?
   Deux essais : avec puis sans parametre anti-cache, car
   certains CDN rejettent les parametres qu'ils ne connaissent
   pas -- un echec la-dessus ne doit pas etre pris pour un
   blocage.
   ---------------------------------------------------------- */
function loadImage(src, timeoutMs) {
  return new Promise(resolve => {
    const img = new Image();
    const t0 = performance.now();
    let done = false;

    const finish = decoded => {
      if (done) return;
      done = true;
      img.onload = img.onerror = null;
      img.src = "";
      resolve({ decoded, ms: performance.now() - t0 });
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    // naturalWidth ecarte les images de 0 pixel que certains
    // portails renvoient pour faire croire a une reussite
    img.onload = () => { clearTimeout(timer); finish(img.naturalWidth > 0); };
    img.onerror = () => { clearTimeout(timer); finish(false); };
    img.referrerPolicy = "no-referrer";
    img.src = src;
  });
}

async function probeContent(iconUrl, timeoutMs) {
  const sep = iconUrl.includes("?") ? "&" : "?";
  const first = await loadImage(iconUrl + sep + "_=" + Date.now(), timeoutMs);
  if (first.decoded) return first;
  const second = await loadImage(iconUrl, timeoutMs);
  return { decoded: second.decoded, ms: first.ms + second.ms };
}

/* ----------------------------------------------------------
   VERDICT D'UN POINT D'ACCES

   ctx = { baselineMs, networkHonest, hasIcon }
   networkHonest : les canaris ont bien echoue, le reseau ne
   fabrique pas de reponses.
   ---------------------------------------------------------- */
function classifyProbe(net, content, ctx) {
  const { baselineMs, networkHonest, hasIcon } = ctx;
  const suspiciouslyFast =
    baselineMs > 0 &&
    net.ms < Math.max(baselineMs * LOCAL_ANSWER_RATIO, LOCAL_ANSWER_FLOOR_MS);

  // --- rien n'est passe
  if (!net.reached) {
    if (hasIcon && content.decoded) {
      // les images du domaine passent mais la page est refusee :
      // filtrage par URL plutot que par domaine
      return { state: STATE.FILTERED, confidence: "moyenne",
               why: "le domaine repond, mais cette adresse precise est refusee" };
    }
    if (net.timedOut) {
      return { state: STATE.BLOCKED, confidence: "haute",
               why: "aucune reponse avant expiration -- paquets absorbes en silence" };
    }
    return { state: STATE.BLOCKED,
             confidence: net.ms < FAST_FAIL_MS ? "haute" : "moyenne",
             why: net.ms < FAST_FAIL_MS
               ? "refus immediat -- DNS detourne ou connexion coupee"
               : "connexion impossible" };
  }

  // --- le paquet est sorti : reste a savoir QUI a repondu

  // preuve directe, elle prime sur tout le reste
  if (hasIcon && content.decoded) {
    return { state: STATE.OPEN, confidence: "haute",
             why: "image authentique du site recue -- le vrai serveur repond" };
  }

  // le reseau fabrique des reponses : aboutir ne prouve plus rien
  if (!networkHonest) {
    return { state: STATE.FILTERED,
             confidence: suspiciouslyFast ? "haute" : "moyenne",
             why: suspiciouslyFast
               ? "reponse locale instantanee sur un reseau qui repond a tout"
               : "ce reseau repond meme aux adresses inexistantes -- reponse non fiable" };
  }

  // reponse trop rapide pour venir de loin
  if (suspiciouslyFast) {
    return { state: STATE.FILTERED, confidence: "moyenne",
             why: "reponse en " + Math.round(net.ms) + " ms, trop rapide pour le serveur distant" };
  }

  // le reseau est honnete et le delai correspond a un vrai trajet :
  // le paquet a reellement voyage. L'image, elle, peut echouer pour
  // des raisons qui ne regardent pas le reseau.
  return { state: STATE.OPEN, confidence: "moyenne",
           why: hasIcon
             ? "le serveur distant a repondu ; l'image n'est pas verifiable ici (politique du site)"
             : "le serveur distant a repondu dans un delai normal" };
}

/* ----------------------------------------------------------
   VERDICT D'UN SERVICE : synthese de ses points d'acces
   ---------------------------------------------------------- */
function aggregate(probeResults) {
  const open = probeResults.filter(p => p.state === STATE.OPEN);
  const shut = probeResults.filter(p => p.state !== STATE.OPEN);

  const worstConf = rs => rs.reduce(
    (acc, r) => CONF_RANK[r.confidence] < CONF_RANK[acc] ? r.confidence : acc, "haute");

  if (shut.length === 0) {
    return { state: STATE.OPEN, confidence: worstConf(open),
             why: probeResults.length > 1
               ? "tous les points d'acces repondent"
               : open[0].why };
  }

  if (open.length === 0) {
    const anyFiltered = shut.some(p => p.state === STATE.FILTERED);
    return { state: anyFiltered ? STATE.FILTERED : STATE.BLOCKED,
             confidence: worstConf(shut),
             why: probeResults.length > 1
               ? "aucun point d'acces ne repond"
               : shut[0].why };
  }

  // le coeur du cas MiniMax : la page s'ouvre, le reste non
  return {
    state: STATE.PARTIAL,
    confidence: worstConf(probeResults),
    why: "accessible : " + open.map(p => p.label).join(", ") +
         " — hors d'atteinte : " + shut.map(p => p.label).join(", "),
  };
}

/* ==========================================================
   MOTEUR
   Teste les points d'acces un par un, comme le .bat d'origine :
   la sequence est plus lisible a l'ecran et les mesures de
   temps ne se genent pas entre elles.
   ========================================================== */
class ProbeEngine {
  constructor({ targets, controls, canaries, onUpdate, onTarget,
                timeoutMs = 8000, gapMs = 250 }) {
    this.targets = targets;
    this.controls = controls;
    this.canaries = canaries || [];
    this.onUpdate = onUpdate || (() => {});
    this.onTarget = onTarget || (() => {});
    this.timeoutMs = timeoutMs;
    this.gapMs = gapMs;

    this.results = {};          // name -> verdict du service
    this.baselineMs = 0;        // latence normale du reseau
    this.contentTrusted = true; // la sonde image fonctionne-t-elle ici ?
    this.networkHonest = true;  // le reseau ment-il sur l'existence des domaines ?
    this.calibrated = false;
    this.running = false;
    this.pass = 0;
    this.current = null;
  }

  /* Mesure la latence de reference, verifie que la sonde image
     est exploitable, et interroge les canaris. */
  async calibrate() {
    const times = [];
    let decoded = 0, tried = 0;

    for (const c of this.controls) {
      const net = await probeNetwork(c.url, this.timeoutMs);
      if (net.reached) times.push(net.ms);
      if (c.icon) {
        tried++;
        const content = await probeContent(c.icon, this.timeoutMs);
        if (content.decoded) decoded++;
      }
    }

    times.sort((a, b) => a - b);
    this.baselineMs = times.length ? times[Math.floor(times.length / 2)] : 0;
    this.contentTrusted = tried > 0 && decoded > 0;

    // un canari qui "repond" = le reseau fabrique des reponses
    let fabricated = 0;
    for (const mk of this.canaries) {
      const net = await probeNetwork(mk(), this.timeoutMs);
      if (net.reached) fabricated++;
    }
    this.networkHonest = fabricated === 0;

    this.calibrated = true;
    this.onUpdate(this.snapshot());
    return {
      baselineMs: this.baselineMs,
      contentTrusted: this.contentTrusted,
      networkHonest: this.networkHonest,
    };
  }

  async testOne(target) {
    this.current = target.name;
    this.results[target.name] = { ...(this.results[target.name] || {}), state: STATE.TESTING };
    this.onTarget(target.name);
    this.onUpdate(this.snapshot());

    const ctxBase = { baselineMs: this.baselineMs, networkHonest: this.networkHonest };
    const probeResults = [];

    for (const p of target.probes) {
      const net = await probeNetwork(p.url, this.timeoutMs);
      const content = p.icon
        ? await probeContent(p.icon, this.timeoutMs)
        : { decoded: false, ms: 0 };

      const v = classifyProbe(net, content, { ...ctxBase, hasIcon: !!p.icon });
      probeResults.push({
        label: p.label, url: p.url,
        state: v.state, confidence: v.confidence, why: v.why,
        ms: Math.round(net.ms),
        netReached: net.reached,
        contentDecoded: p.icon ? content.decoded : null,
      });

      if (this.gapMs && target.probes.length > 1) {
        await new Promise(r => setTimeout(r, this.gapMs));
      }
    }

    const agg = aggregate(probeResults);
    const prev = this.results[target.name] || {};

    this.results[target.name] = {
      name: target.name,
      state: agg.state,
      confidence: agg.confidence,
      why: agg.why,
      ms: Math.round(probeResults.reduce((a, p) => a + p.ms, 0) / probeResults.length),
      probes: probeResults,
      at: new Date().toTimeString().slice(0, 8),
      // suit les changements d'un tour a l'autre : un service qui
      // bascule sans arret signale un filtrage intermittent
      flips: prev.state && prev.state !== STATE.TESTING && prev.state !== agg.state
        ? (prev.flips || 0) + 1
        : (prev.flips || 0),
    };

    this.onUpdate(this.snapshot());
    return this.results[target.name];
  }

  snapshot() {
    return {
      results: this.results,
      current: this.current,
      pass: this.pass,
      baselineMs: Math.round(this.baselineMs),
      contentTrusted: this.contentTrusted,
      networkHonest: this.networkHonest,
      calibrated: this.calibrated,
      running: this.running,
      summary: this.summary(),
    };
  }

  summary() {
    const c = { OPEN: 0, PARTIAL: 0, FILTERED: 0, BLOCKED: 0, UNKNOWN: 0 };
    this.targets.forEach(t => {
      const s = this.results[t.name];
      const st = s && s.state !== STATE.TESTING ? s.state : STATE.UNKNOWN;
      c[st] = (c[st] || 0) + 1;
    });
    c.total = this.targets.length;
    c.done = c.total - c.UNKNOWN;
    return c;
  }

  async start({ loop = true } = {}) {
    if (this.running) return;
    this.running = true;

    if (!this.calibrated) await this.calibrate();

    do {
      this.pass++;
      for (const t of this.targets) {
        if (!this.running) break;
        await this.testOne(t);
        if (!this.running) break;
        await new Promise(r => setTimeout(r, this.gapMs));
      }
    } while (this.running && loop);

    this.running = false;
    this.current = null;
    this.onUpdate(this.snapshot());
  }

  stop() {
    this.running = false;
    this.current = null;
  }

  /* Releve texte, a joindre a une demande au service informatique. */
  report() {
    const lines = [];
    this.targets.forEach(t => {
      const r = this.results[t.name];
      if (!r || r.state === STATE.TESTING) { lines.push(`${t.name}\tnon teste`); return; }
      lines.push([t.name, LABEL[r.state], r.confidence, r.ms + " ms"].join("\t"));
      if (r.probes && r.probes.length > 1) {
        r.probes.forEach(p => lines.push(`  ${p.label}\t${LABEL[p.state]}\t${p.ms} ms\t${p.url}`));
      } else if (r.probes) {
        lines.push(`  \t\t\t${r.probes[0].url}`);
      }
    });

    const s = this.summary();
    return [
      "Test d'acces aux services d'IA generative",
      "Date : " + new Date().toLocaleString("fr-FR"),
      "",
      "Conditions de mesure",
      "  latence de reference du reseau : " + Math.round(this.baselineMs) + " ms",
      "  verification du contenu : " + (this.contentTrusted ? "active" : "indisponible"),
      "  reponses aux domaines inexistants : " +
        (this.networkHonest ? "aucune (reseau honnete)" : "OUI -- un equipement repond a tout"),
      "",
      `Ouverts ${s.OPEN} / Partiels ${s.PARTIAL} / Filtres ${s.FILTERED} / Coupes ${s.BLOCKED} sur ${s.total}`,
      "",
      "SERVICE\tVERDICT\tCONFIANCE\tDELAI",
      ...lines,
      "",
      "Mesure effectuee depuis un navigateur, sans lecture du contenu des",
      "reponses (regle CORS). Un verdict 'filtre' ou 'coupe' indique que le",
      "reseau emprunte empeche l'acces ; il ne prejuge pas d'une panne du",
      "service lui-meme.",
    ].join("\n");
  }
}

const LABEL = {
  OPEN: "OUVERT", PARTIAL: "PARTIEL", FILTERED: "FILTRE", BLOCKED: "COUPE",
  TESTING: "TEST...", UNKNOWN: "-",
};
