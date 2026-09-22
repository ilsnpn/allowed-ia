/* ==========================================================
   CIBLES TESTEES
   Reprend la liste de PING-LLM.bat. Les coordonnees servent
   uniquement a placer le point sur le globe : elles designent
   la region d'origine de l'editeur, pas l'IP du serveur (qui
   est de toute facon derriere un CDN mondial).

   Les positions d'une meme region sont volontairement ecartees
   de quelques degres pour rester lisibles a l'echelle du globe.

   PLUSIEURS POINTS D'ACCES PAR SERVICE
   Un service n'est pas un seul domaine. MiniMax laisse passer
   chat.minimax.io mais bloque agent.minimax.io : la page
   s'ouvre, les modeles restent hors de portee. Chaque service
   liste donc ses points d'acces, et le verdict devient PARTIEL
   quand les uns passent et les autres non.

     name    libelle affiche
     probes  points d'acces testes
       label nom court affiche dans le detail
       url   page testee (sonde reseau)
       icon  image servie par CE domaine (sonde de contenu).
             Facultatif : beaucoup de sites interdisent le
             chargement de leurs images depuis ailleurs
             (en-tete Cross-Origin-Resource-Policy), l'absence
             de reponse n'est alors pas un signe de blocage.
     ab      monogramme du badge (1 a 3 lettres)
     color   couleur de la marque
   ========================================================== */

const HOME = { name: "VOUS", lat: 46.948, lng: 7.447 };

const TARGETS = [
  // --- cote ouest US : eventail autour de la baie de San Francisco
  { name: "CHATGPT", lat: 37.8, lng: -122.4, ab: "GPT", color: "#10a37f",
    probes: [
      { label: "chat", url: "https://chatgpt.com", icon: "https://chatgpt.com/favicon.ico" },
    ] },

  { name: "CLAUDE", lat: 41.0, lng: -124.5, ab: "C", color: "#d97757",
    probes: [
      // favicon volontairement absent : claude.ai renvoie
      // Cross-Origin-Resource-Policy: same-origin, l'image ne peut
      // pas etre chargee ici meme quand le site est parfaitement
      // accessible. La sonde reseau suffit.
      { label: "app", url: "https://claude.ai" },
    ] },

  { name: "PERPLEXITY", lat: 34.6, lng: -120.8, ab: "P", color: "#20808d",
    probes: [
      { label: "app", url: "https://www.perplexity.ai", icon: "https://www.perplexity.ai/favicon.ico" },
    ] },

  { name: "GEMINI", lat: 36.6, lng: -117.6, ab: "G", color: "#4285f4",
    probes: [
      { label: "app", url: "https://gemini.google.com",
        icon: "https://www.gstatic.com/lamda/images/favicon_v1_150160cddff7f294ce30.svg" },
    ] },

  { name: "META AI", lat: 33.4, lng: -115.8, ab: "M", color: "#0668e1",
    probes: [
      { label: "app", url: "https://www.meta.ai", icon: "https://www.meta.ai/favicon.ico" },
    ] },

  { name: "GROK", lat: 39.6, lng: -119.4, ab: "X", color: "#1a1a1a",
    probes: [
      { label: "app", url: "https://grok.com", icon: "https://grok.com/favicon.ico" },
    ] },

  { name: "COPILOT", lat: 47.7, lng: -122.1, ab: "CP", color: "#0067b8",
    probes: [
      { label: "app", url: "https://copilot.microsoft.com", icon: "https://copilot.microsoft.com/favicon.ico" },
    ] },

  { name: "COPILOT (GITHUB)", lat: 44.5, lng: -119.5, ab: "GH", color: "#6e40c9",
    probes: [
      { label: "app", url: "https://github.com/copilot",
        icon: "https://github.githubassets.com/favicons/favicon.svg" },
    ] },

  // --- Europe
  { name: "LE CHAT (MISTRAL)", lat: 48.85, lng: 2.35, ab: "M", color: "#ff7000",
    probes: [
      { label: "chat", url: "https://chat.mistral.ai", icon: "https://chat.mistral.ai/favicon.ico" },
    ] },

  { name: "LUMO (PROTON)", lat: 44.9, lng: 4.6, ab: "L", color: "#6d4aff",   // Geneve, ecarte au sud-ouest
    probes: [
      { label: "app", url: "https://lumo.proton.me", icon: "https://lumo.proton.me/favicon.ico" },
    ] },

  { name: "EURIA (INFOMANIAK)", lat: 47.6, lng: 9.8, ab: "E", color: "#2072d1",   // Geneve, ecarte au nord-est
    probes: [
      { label: "app", url: "https://euria.infomaniak.com", icon: "https://euria.infomaniak.com/favicon.ico" },
    ] },

  // --- Chine : ecartes autour de leurs villes reelles
  { name: "KIMI", lat: 39.9, lng: 116.4, ab: "K", color: "#1a1a1a",
    probes: [
      { label: "chat", url: "https://www.kimi.com", icon: "https://www.kimi.com/favicon.ico" },
    ] },

  { name: "MIMO (XIAOMI)", lat: 43.0, lng: 112.5, ab: "Mi", color: "#ff6900",
    probes: [
      { label: "app", url: "https://aistudio.xiaomimimo.com", icon: "https://aistudio.xiaomimimo.com/favicon.ico" },
    ] },

  { name: "MINIMAX", lat: 31.2, lng: 122.8, ab: "MM", color: "#7c3aed",
    probes: [
      { label: "chat", url: "https://chat.minimax.io", icon: "https://chat.minimax.io/favicon.ico" },
      // le point qui manquait : la page s'ouvre, mais lancer un
      // modele depuis agent.minimax.io ne passe pas
      { label: "agent", url: "https://agent.minimax.io", icon: "https://agent.minimax.io/favicon.ico" },
    ] },

  { name: "DEEPSEEK", lat: 27.3, lng: 117.0, ab: "DS", color: "#4d6bfe",
    probes: [
      { label: "chat", url: "https://chat.deepseek.com", icon: "https://chat.deepseek.com/favicon.ico" },
    ] },

  { name: "QWEN (ALIBABA)", lat: 30.3, lng: 120.2, ab: "Q", color: "#615ced",
    probes: [
      { label: "chat", url: "https://chat.qwen.ai", icon: "https://chat.qwen.ai/favicon.ico" },
    ] },
];

/* ----------------------------------------------------------
   TEMOINS DE CALIBRATION
   Domaines d'infrastructure quasiment jamais filtres en
   entreprise. Ils ne s'affichent pas sur la carte : ils
   mesurent a quoi ressemble une reponse NORMALE sur ce reseau.

   Leurs icones ont ete verifiees chargeables depuis une autre
   page (pas d'en-tete Cross-Origin-Resource-Policy: same-origin,
   et un type MIME d'image). Un temoin dont l'image ne peut pas
   se charger fausserait la calibration en faisant croire que la
   sonde de contenu est inutilisable sur ce poste.
   ---------------------------------------------------------- */
const CONTROLS = [
  { name: "cloudflare", url: "https://www.cloudflare.com",
    icon: "https://www.cloudflare.com/favicon.ico" },            // CORP: cross-origin -> autorise
  { name: "wikipedia", url: "https://www.wikipedia.org",
    icon: "https://www.wikipedia.org/static/favicon/wikipedia.ico" },
  { name: "wikimedia", url: "https://commons.wikimedia.org",
    icon: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Commons-logo.svg" },
  // c.s-microsoft.com/favicon.ico a ete retire : il renvoie du
  // text/html et non une image, ce qui faussait la calibration.
];

/* ----------------------------------------------------------
   CANARIS
   Domaines qui ne peuvent pas exister : le TLD .invalid est
   reserve par la RFC 2606 et n'est resolu nulle part. Sur un
   reseau honnete, ces adresses echouent -- c'est le resultat
   attendu.

   Si elles REPONDENT, c'est qu'un equipement du reseau fabrique
   des reponses pour tout ce qui passe. Le simple fait qu'une
   requete aboutisse ne prouve alors plus rien, et le moteur
   durcit ses criteres en consequence.
   ---------------------------------------------------------- */
const CANARIES = [
  () => `https://${Math.random().toString(36).slice(2, 12)}.invalid/`,
  () => `https://${Math.random().toString(36).slice(2, 12)}-nonexistent.wikipedia.org/`,
];
