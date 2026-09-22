/* ==========================================================
   CIBLES TESTEES
   Reprend la liste de PING-LLM.bat. Les coordonnees servent
   uniquement a placer le point sur le globe : elles designent
   la region d'origine de l'editeur, pas l'IP du serveur (qui
   est de toute facon derriere un CDN mondial).

   Les positions d'une meme region sont volontairement ecartees
   de quelques degres pour rester lisibles a l'echelle du globe.

   AJOUTER UNE IA : une entree ici suffit, tout le reste suit.
     name    libelle affiche
     url     page testee (sonde reseau)
     icon    URL d'une image servie par le meme domaine
             (sonde de contenu : si elle se decode, le vrai
             serveur a repondu -- pas une page de blocage)
     ab      monogramme du badge (1 a 3 lettres)
     color   couleur de la marque
   ========================================================== */

const HOME = { name: "VOUS", lat: 46.948, lng: 7.447 };

const TARGETS = [
  // --- cote ouest US : eventail autour de la baie de San Francisco
  { name: "CHATGPT", url: "https://chatgpt.com",
    icon: "https://chatgpt.com/favicon.ico",
    lat: 37.8, lng: -122.4, ab: "GPT", color: "#10a37f" },

  { name: "CLAUDE", url: "https://claude.ai",
    icon: "https://claude.ai/favicon.ico",
    lat: 41.0, lng: -124.5, ab: "C", color: "#d97757" },

  { name: "PERPLEXITY", url: "https://www.perplexity.ai",
    icon: "https://www.perplexity.ai/favicon.ico",
    lat: 34.6, lng: -120.8, ab: "P", color: "#20808d" },

  { name: "GEMINI", url: "https://gemini.google.com",
    icon: "https://www.gstatic.com/lamda/images/favicon_v1_150160cddff7f294ce30.svg",
    lat: 36.6, lng: -117.6, ab: "G", color: "#4285f4" },

  { name: "META AI", url: "https://www.meta.ai",
    icon: "https://www.meta.ai/favicon.ico",
    lat: 33.4, lng: -115.8, ab: "M", color: "#0668e1" },

  { name: "GROK", url: "https://grok.com",
    icon: "https://grok.com/favicon.ico",
    lat: 39.6, lng: -119.4, ab: "X", color: "#1a1a1a" },

  { name: "COPILOT", url: "https://copilot.microsoft.com",
    icon: "https://copilot.microsoft.com/favicon.ico",
    lat: 47.7, lng: -122.1, ab: "CP", color: "#0067b8" },

  { name: "COPILOT (GITHUB)", url: "https://github.com/copilot",
    icon: "https://github.githubassets.com/favicons/favicon.svg",
    lat: 44.5, lng: -119.5, ab: "GH", color: "#6e40c9" },

  // --- Europe
  { name: "LE CHAT (MISTRAL)", url: "https://chat.mistral.ai",
    icon: "https://chat.mistral.ai/favicon.ico",
    lat: 48.85, lng: 2.35, ab: "M", color: "#ff7000" },

  { name: "LUMO (PROTON)", url: "https://lumo.proton.me",
    icon: "https://lumo.proton.me/favicon.ico",
    lat: 44.9, lng: 4.6, ab: "L", color: "#6d4aff" },   // Geneve, ecarte au sud-ouest

  { name: "EURIA (INFOMANIAK)", url: "https://euria.infomaniak.com",
    icon: "https://euria.infomaniak.com/favicon.ico",
    lat: 47.6, lng: 9.8, ab: "E", color: "#2072d1" },   // Geneve, ecarte au nord-est

  // --- Chine : ecartes autour de leurs villes reelles
  { name: "KIMI", url: "https://www.kimi.com",
    icon: "https://www.kimi.com/favicon.ico",
    lat: 39.9, lng: 116.4, ab: "K", color: "#1a1a1a" },

  { name: "MIMO (XIAOMI)", url: "https://aistudio.xiaomimimo.com",
    icon: "https://aistudio.xiaomimimo.com/favicon.ico",
    lat: 43.0, lng: 112.5, ab: "Mi", color: "#ff6900" },

  { name: "MINIMAX", url: "https://chat.minimax.io",
    icon: "https://chat.minimax.io/favicon.ico",
    lat: 31.2, lng: 122.8, ab: "MM", color: "#7c3aed" },

  { name: "DEEPSEEK", url: "https://chat.deepseek.com",
    icon: "https://chat.deepseek.com/favicon.ico",
    lat: 27.3, lng: 117.0, ab: "DS", color: "#4d6bfe" },

  { name: "QWEN (ALIBABA)", url: "https://chat.qwen.ai",
    icon: "https://chat.qwen.ai/favicon.ico",
    lat: 30.3, lng: 120.2, ab: "Q", color: "#615ced" },
];

/* ----------------------------------------------------------
   TEMOINS DE CALIBRATION
   Domaines d'infrastructure quasiment jamais filtres en
   entreprise. Ils ne s'affichent pas sur la carte : ils
   servent a mesurer a quoi ressemble une reponse NORMALE sur
   ce reseau (latence de reference), pour pouvoir reperer
   ensuite les reponses anormalement rapides = interception
   par un equipement local.
   ---------------------------------------------------------- */
const CONTROLS = [
  { name: "cloudflare", url: "https://www.cloudflare.com",
    icon: "https://www.cloudflare.com/favicon.ico" },
  { name: "wikipedia", url: "https://www.wikipedia.org",
    icon: "https://www.wikipedia.org/static/favicon/wikipedia.ico" },
  { name: "microsoft", url: "https://www.microsoft.com",
    icon: "https://c.s-microsoft.com/favicon.ico" },
];
