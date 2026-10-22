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
   ========================================================== */

const HOME = { name: "VOUS", lat: 46.948, lng: 7.447 };

const TARGETS = [
  // --- cote ouest US : eventail autour de la baie de San Francisco
  { name: "CHATGPT", lat: 37.8, lng: -122.4,
    probes: [
      { label: "chat", url: "https://chatgpt.com", icon: "https://chatgpt.com/favicon.ico" },
    ] },

  { name: "CLAUDE", lat: 41.0, lng: -124.5,
    probes: [
      // claude.ai renvoie Cross-Origin-Resource-Policy: same-origin
      // sur sa page d'accueil, ses images et robots.txt : le fetch
      // echoue comme si le reseau avait refuse, meme sur une
      // connexion libre. /api/ ne porte pas cet en-tete. Aucune
      // image du domaine n'est chargeable : pas d'icone.
      { label: "app", url: "https://claude.ai/api/" },
    ] },

  { name: "PERPLEXITY", lat: 34.6, lng: -120.8,
    probes: [
      // meme piege que claude.ai sur la page d'accueil et favicon.ico
      // (CORP same-origin) ; robots.txt et apple-touch-icon y echappent
      { label: "app", url: "https://www.perplexity.ai/robots.txt",
        icon: "https://www.perplexity.ai/apple-touch-icon.png" },
    ] },

  { name: "GEMINI", lat: 36.6, lng: -117.6,
    probes: [
      { label: "app", url: "https://gemini.google.com",
        icon: "https://www.gstatic.com/lamda/images/favicon_v1_150160cddff7f294ce30.svg" },
    ] },

  { name: "META AI", lat: 33.4, lng: -115.8,
    probes: [
      { label: "app", url: "https://www.meta.ai", icon: "https://www.meta.ai/favicon.ico" },
    ] },

  { name: "GROK", lat: 39.6, lng: -119.4,
    probes: [
      { label: "app", url: "https://grok.com", icon: "https://grok.com/images/favicon.ico" },
    ] },

  { name: "COPILOT", lat: 47.7, lng: -122.1,
    probes: [
      { label: "app", url: "https://copilot.microsoft.com", icon: "https://copilot.microsoft.com/favicon.ico" },
    ] },

  { name: "COPILOT (GITHUB)", lat: 44.5, lng: -119.5,
    probes: [
      { label: "app", url: "https://github.com/copilot", icon: "https://github.com/favicon.ico" },
    ] },

  { name: "NVIDIA BUILD", lat: 38.6, lng: -113.8,
    probes: [
      { label: "catalogue", url: "https://build.nvidia.com", icon: "https://build.nvidia.com/favicon.ico" },
      { label: "api", url: "https://integrate.api.nvidia.com" },
    ] },

  { name: "HIGGSFIELD", lat: 42.3, lng: -115.0,
    probes: [
      { label: "app", url: "https://higgsfield.ai", icon: "https://higgsfield.ai/favicon.ico" },
    ] },

  // --- Europe
  { name: "ELEVENLABS", lat: 51.5, lng: -0.1,
    probes: [
      { label: "app", url: "https://elevenlabs.io/app", icon: "https://elevenlabs.io/favicon.ico" },
      { label: "api", url: "https://api.elevenlabs.io" },
    ] },

  { name: "LE CHAT (MISTRAL)", lat: 48.85, lng: 2.35,
    probes: [
      // aucune image de chat.mistral.ai n'est chargeable depuis
      // ailleurs (favicon.ico renvoie du HTML) : pas d'icone
      { label: "chat", url: "https://chat.mistral.ai" },
    ] },

  { name: "LUMO (PROTON)", lat: 44.9, lng: 4.6,   // Geneve, ecarte au sud-ouest
    probes: [
      { label: "app", url: "https://lumo.proton.me", icon: "https://lumo.proton.me/assets/favicon.ico" },
    ] },

  { name: "EURIA (INFOMANIAK)", lat: 47.6, lng: 9.8,   // Geneve, ecarte au nord-est
    probes: [
      { label: "app", url: "https://euria.infomaniak.com", icon: "https://euria.infomaniak.com/favicon.ico" },
    ] },

  // --- Chine : ecartes autour de leurs villes reelles
  { name: "KIMI", lat: 39.9, lng: 116.4,
    probes: [
      { label: "chat", url: "https://www.kimi.com", icon: "https://www.kimi.com/favicon.ico" },
    ] },

  { name: "MIMO (XIAOMI)", lat: 43.0, lng: 112.5,
    probes: [
      // aistudio.xiaomimimo.com a ete retire par Xiaomi : son DNS
      // pointe sur 127.0.0.1 partout, ce qui passait pour un blocage
      { label: "site", url: "https://mimo.xiaomi.com" },
      { label: "plateforme", url: "https://platform.xiaomimimo.com",
        icon: "https://platform.xiaomimimo.com/favicon.png" },
    ] },

  { name: "MINIMAX", lat: 31.2, lng: 122.8,
    probes: [
      { label: "chat", url: "https://chat.minimax.io", icon: "https://chat.minimax.io/favicon.ico" },
      // le point qui manquait : la page s'ouvre, mais lancer un
      // modele depuis agent.minimax.io ne passe pas
      { label: "agent", url: "https://agent.minimax.io",
        icon: "https://agent.minimax.io/assets/logo/favicon_v2.png" },
    ] },

  { name: "DEEPSEEK", lat: 27.3, lng: 117.0,
    probes: [
      // chat.deepseek.com ne sert aucune image chargeable d'ailleurs ;
      // celle de son CDN, sur le meme domaine deepseek.com, l'est
      { label: "chat", url: "https://chat.deepseek.com", icon: "https://cdn.deepseek.com/chat/icon.png" },
    ] },

  { name: "QWEN (ALIBABA)", lat: 30.3, lng: 120.2,
    probes: [
      { label: "chat", url: "https://chat.qwen.ai", icon: "https://chat.qwen.ai/static/favicon.png" },
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
