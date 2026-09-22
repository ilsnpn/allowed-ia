/* ==========================================================
   MOTEUR DE TEST -- cote navigateur, sans serveur

   CONTRAINTE DE DEPART
   Un navigateur ne peut PAS lire le code HTTP ni le contenu
   d'une reponse venant d'un autre domaine (regle CORS). La
   version .bat le pouvait via curl : elle cherchait "zscaler",
   "access denied"... dans le corps de la page. Ici, impossible.

   CONTOURNEMENT : deux sondes independantes par cible.

   1. SONDE RESEAU -- fetch(url, {mode:"no-cors"})
      La reponse est "opaque" : illisible. Mais la PROMESSE,
      elle, parle : elle aboutit si le paquet est passe, elle
      echoue si le reseau a refuse (DNS menteur, connexion
      coupee, TLS interrompu). C'est le signal de connectivite.

   2. SONDE CONTENU -- chargement du favicon en tant qu'IMAGE
      Le navigateur refuse de nous montrer l'image, mais il
      accepte de la DECODER. Si le decodage reussit, l'octet
      recu est bien une image : le vrai serveur a repondu. Un
      portail de blocage, lui, renvoie du HTML -- le decodage
      echoue. C'est le signal d'authenticite.

   Le croisement des deux separe "ouvert", "intercepte" et
   "coupe". Aucune sonde n'est fiable seule.

   GARDE-FOU
   Des temoins neutres (Cloudflare, Wikipedia, Microsoft) sont
   testes en parallele. Ils donnent la latence normale du
   reseau, et surtout ils verifient que la sonde contenu
   fonctionne ici : si elle echoue meme sur les temoins, c'est
   le navigateur ou une extension qui la bloque, pas les IA.
   Le moteur la desactive alors au lieu d'accuser 16 sites a
   tort.
   ========================================================== */

const STATE = {
  OPEN:     "OPEN",      // le vrai service repond
  FILTERED: "FILTERED",  // quelque chose repond a sa place
  BLOCKED:  "BLOCKED",   // rien ne passe
  TESTING:  "TESTING",
  UNKNOWN:  "UNKNOWN",
};

/* Une reponse plus rapide que ce seuil, rapportee a la latence
   de reference du reseau, trahit un equipement qui repond en
   local au lieu de laisser sortir le paquet. */
const LOCAL_ANSWER_RATIO = 0.35;
const LOCAL_ANSWER_FLOOR_MS = 25;

/* En dessous de ce delai, un echec vient d'un refus immediat
   (DNS ou reset) et non d'une connexion qui n'aboutit pas. */
const FAST_FAIL_MS = 400;

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
   ---------------------------------------------------------- */
function probeContent(iconUrl, timeoutMs) {
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
    img.src = iconUrl + (iconUrl.includes("?") ? "&" : "?") + "_=" + Date.now();
  });
}

/* ----------------------------------------------------------
   VERDICT
   contentTrusted : false quand la sonde contenu s'est revelee
   inutilisable sur les temoins -- on retombe alors sur la
   seule sonde reseau, en le disant.
   ---------------------------------------------------------- */
function classify(net, content, baselineMs, contentTrusted) {
  const suspiciouslyFast =
    baselineMs > 0 &&
    net.ms < Math.max(baselineMs * LOCAL_ANSWER_RATIO, LOCAL_ANSWER_FLOOR_MS);

  // --- rien n'est passe
  if (!net.reached) {
    if (contentTrusted && content.decoded) {
      // la page principale est refusee mais les images du domaine
      // passent : filtrage par URL plutot que par domaine
      return { state: STATE.FILTERED, confidence: "moyenne",
               why: "le domaine repond, mais la page de chat est refusee" };
    }
    if (net.timedOut) {
      return { state: STATE.BLOCKED, confidence: "haute",
               why: "aucune reponse avant expiration -- paquets absorbes en silence" };
    }
    return { state: STATE.BLOCKED, confidence: net.ms < FAST_FAIL_MS ? "haute" : "moyenne",
             why: net.ms < FAST_FAIL_MS
               ? "refus immediat -- DNS detourne ou connexion coupee"
               : "connexion impossible" };
  }

  // --- le reseau a laisse passer, reste a savoir QUI a repondu
  if (!contentTrusted) {
    return { state: suspiciouslyFast ? STATE.FILTERED : STATE.OPEN,
             confidence: "faible",
             why: suspiciouslyFast
               ? "reponse trop rapide pour venir du serveur distant"
               : "connexion etablie (verification du contenu indisponible)" };
  }

  if (content.decoded) {
    return { state: STATE.OPEN, confidence: "haute",
             why: "image authentique du site recue -- le vrai serveur repond" };
  }

  if (suspiciouslyFast) {
    return { state: STATE.FILTERED, confidence: "haute",
             why: "reponse locale instantanee, contenu non conforme -- portail de blocage" };
  }

  return { state: STATE.FILTERED, confidence: "moyenne",
           why: "connexion acceptee mais contenu du site non recu" };
}

/* ==========================================================
   MOTEUR
   Teste les cibles une par une, comme le .bat d'origine :
   la sequence est plus lisible a l'ecran et les mesures de
   temps ne se genent pas entre elles.
   ========================================================== */
class ProbeEngine {
  constructor({ targets, controls, onUpdate, onTarget, timeoutMs = 8000, gapMs = 400 }) {
    this.targets = targets;
    this.controls = controls;
    this.onUpdate = onUpdate || (() => {});
    this.onTarget = onTarget || (() => {});
    this.timeoutMs = timeoutMs;
    this.gapMs = gapMs;

    this.results = {};        // name -> verdict
    this.baselineMs = 0;      // latence normale du reseau
    this.contentTrusted = true;
    this.calibrated = false;
    this.running = false;
    this.pass = 0;
    this.current = null;
  }

  /* Mesure la latence de reference et verifie que la sonde
     contenu est exploitable sur ce poste. */
  async calibrate() {
    const times = [];
    let decoded = 0, tried = 0;

    for (const c of this.controls) {
      const net = await probeNetwork(c.url, this.timeoutMs);
      if (net.reached) times.push(net.ms);
      const content = await probeContent(c.icon, this.timeoutMs);
      tried++;
      if (content.decoded) decoded++;
    }

    times.sort((a, b) => a - b);
    this.baselineMs = times.length ? times[Math.floor(times.length / 2)] : 0;

    // aucun temoin n'a rendu d'image : la sonde est inutilisable ici
    // (extension de blocage, mode restreint, aucun reseau du tout)
    this.contentTrusted = tried > 0 && decoded > 0;
    this.calibrated = true;

    this.onUpdate(this.snapshot());
    return { baselineMs: this.baselineMs, contentTrusted: this.contentTrusted, controlsOk: decoded };
  }

  async testOne(target) {
    this.current = target.name;
    this.results[target.name] = { ...(this.results[target.name] || {}), state: STATE.TESTING };
    this.onTarget(target.name);
    this.onUpdate(this.snapshot());

    const net = await probeNetwork(target.url, this.timeoutMs);
    const content = target.icon
      ? await probeContent(target.icon, this.timeoutMs)
      : { decoded: false, ms: 0 };

    const verdict = classify(net, content, this.baselineMs, this.contentTrusted);
    const prev = this.results[target.name] || {};

    this.results[target.name] = {
      name: target.name,
      state: verdict.state,
      confidence: verdict.confidence,
      why: verdict.why,
      ms: Math.round(net.ms),
      netReached: net.reached,
      contentDecoded: content.decoded,
      at: new Date().toTimeString().slice(0, 8),
      // suit les changements d'un tour a l'autre : un site qui
      // bascule sans arret signale un filtrage intermittent
      flips: prev.state && prev.state !== STATE.TESTING && prev.state !== verdict.state
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
      calibrated: this.calibrated,
      running: this.running,
      summary: this.summary(),
    };
  }

  summary() {
    const c = { OPEN: 0, FILTERED: 0, BLOCKED: 0, UNKNOWN: 0 };
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

  /* Export du releve pour le transmettre au service informatique. */
  report() {
    const lines = this.targets.map(t => {
      const r = this.results[t.name];
      if (!r || r.state === STATE.TESTING) return `${t.name}\tnon teste`;
      return [t.name, LABEL[r.state], r.confidence, r.ms + " ms", t.url].join("\t");
    });
    const s = this.summary();
    return [
      "Test d'acces aux services d'IA generative",
      "Date : " + new Date().toLocaleString("fr-FR"),
      "Latence de reference du reseau : " + Math.round(this.baselineMs) + " ms",
      "Verification du contenu : " + (this.contentTrusted ? "active" : "indisponible"),
      "",
      `Ouverts ${s.OPEN} / Filtres ${s.FILTERED} / Coupes ${s.BLOCKED} sur ${s.total}`,
      "",
      "SERVICE\tVERDICT\tCONFIANCE\tDELAI\tURL",
      ...lines,
      "",
      "Mesure effectuee depuis le navigateur. Un verdict 'filtre' ou",
      "'coupe' indique que le reseau emprunte empeche l'acces ; il ne",
      "prejuge pas d'une panne du service lui-meme.",
    ].join("\n");
  }
}

const LABEL = {
  OPEN: "OUVERT", FILTERED: "FILTRE", BLOCKED: "COUPE",
  TESTING: "TEST...", UNKNOWN: "-",
};
