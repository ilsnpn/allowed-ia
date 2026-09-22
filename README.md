# Accès IA

Un site qui teste, **depuis votre propre navigateur**, quels services d'IA générative
sont accessibles ou bloqués par le réseau que vous utilisez : entreprise, école,
hôtspot public.

Résultat affiché sur un globe 3D ou un planisphère, avec un relevé texte copiable
à joindre à une demande au service informatique.

---

## Pourquoi ce projet

Ce dépôt est la version web d'un outil local (`Local Test/`) qui interrogeait les mêmes
sites avec `curl` depuis une fenêtre Windows. Cette version-là avait deux défauts :
elle demandait de lancer un `.bat`, et `curl` ignore le proxy Windows — un site pouvait
apparaître ouvert alors que le navigateur le voyait bloqué.

La version web teste avec le navigateur lui-même, donc **dans les conditions réelles
d'usage**, et se partage par un simple lien.

---

## Comment le test fonctionne

Un navigateur n'a pas le droit de lire le code HTTP ni le contenu d'une réponse venant
d'un autre domaine : c'est la règle CORS, et elle n'est pas contournable. La version
`curl` cherchait `zscaler`, `access denied`… dans le corps de la page ; ici c'est
impossible.

Le test repose donc sur trois sondes, et surtout sur **une règle d'asymétrie** qui
détermine ce que chacune a le droit de prouver.

### 1. Sonde réseau — le paquet sort-il ?

```js
fetch(url, { mode: "no-cors" })
```

La réponse est *opaque* : illisible. Mais la promesse, elle, parle. Elle aboutit si le
paquet est passé, elle échoue si le réseau a refusé — DNS menteur, connexion coupée,
TLS interrompu. Un site qui répond `403` compte comme joignable : la couche réseau a
bien fonctionné.

### 2. Sonde contenu — qui a répondu ?

Le favicon du site est chargé **en tant qu'image**. Le navigateur refuse de nous la
montrer, mais il accepte de la décoder. Si le décodage réussit, l'octet reçu est bien
une image : le vrai serveur a répondu.

**Sa réussite prouve quelque chose ; son échec ne prouve rien.** C'est le point le plus
important du moteur, et une première version s'y est trompée. Beaucoup de sites
interdisent le chargement de leurs images depuis une autre page via l'en-tête
`Cross-Origin-Resource-Policy: same-origin` — c'est le cas de `claude.ai` :

```
$ curl -sI https://claude.ai/favicon.ico | grep -i cross-origin
Cross-Origin-Resource-Policy: same-origin
```

L'image échoue alors **quel que soit l'état du réseau**, y compris depuis une connexion
parfaitement libre. Un échec d'image ne peut donc jamais, à lui seul, faire conclure à
un blocage. Les services concernés déclarent simplement `icon` absent dans
`targets.js`.

### 3. Canaris — le réseau ment-il ?

Des adresses qui ne peuvent pas exister sont testées, sur le TLD `.invalid` réservé par
la [RFC 2606](https://www.rfc-editor.org/rfc/rfc2606) et résolu nulle part, plus un
sous-domaine aléatoire d'un domaine réel.

Sur un réseau honnête, ces adresses échouent — c'est le résultat attendu. Si elles
**répondent**, un équipement fabrique des réponses pour tout ce qui passe : le fait
qu'une requête aboutisse ne prouve alors plus rien, et le moteur durcit ses critères.

C'est le canari, et non l'échec d'une image, qui autorise un verdict négatif.

### Calibration

Trois domaines d'infrastructure neutres (Cloudflare, Wikipedia, Microsoft) donnent la
**latence normale** du réseau. Une réponse nettement plus rapide que cette référence
n'a pas eu le temps de traverser l'Atlantique : elle vient d'un équipement local.

### Table de décision

Pour un point d'accès, réseau honnête :

| Paquet sort | Image authentique | Délai | Verdict | Confiance |
|---|---|---|---|---|
| oui | oui | — | **Ouvert** | haute |
| oui | non / non vérifiable | normal | **Ouvert** | moyenne |
| oui | non | anormalement court | **Filtré** | moyenne |
| non | oui | — | **Filtré** (par URL) | moyenne |
| non | non | refus immédiat | **Coupé** | haute |
| non | non | délai expiré | **Coupé** | haute |

Si un canari a répondu, la deuxième ligne bascule en **Filtré** : sur un réseau qui
répond à tout, aboutir ne veut plus rien dire.

### Plusieurs points d'accès par service

Un service n'est pas un seul domaine. MiniMax laisse passer `chat.minimax.io` mais
bloque `agent.minimax.io` : la page s'ouvre, les modèles restent hors de portée.

Chaque service liste donc ses points d'accès, et le verdict devient **partiel** (ambre)
quand les uns passent et les autres non. Le détail au survol indique lesquels.

---

## Limites — à lire avant de conclure

- **Pas de lecture de la page de blocage.** Le verdict repose sur des indices croisés,
  pas sur une preuve. Chaque ligne affiche sa confiance (`●` à `●●●`) ; un `●●` ne se
  cite pas comme un fait.
- **« Bloqué » ne veut pas dire « votre entreprise l'a décidé ».** Le service peut être
  en panne, ou refuser votre pays. Sans test de référence côté serveur, les deux cas
  sont indiscernables ; le site ne prétend pas trancher.
- **Un service joignable n'est pas un service utilisable.** La page d'accueil peut
  répondre alors que la connexion au compte est bloquée — d'où les points d'accès
  multiples, qui réduisent cet angle mort sans le supprimer.
- **Ces requêtes sont visibles.** Elles partent vers les sites testés depuis votre poste
  et apparaîtront dans les journaux du réseau utilisé, comme une visite normale.

---

## Vie privée

Tout se passe dans l'onglet. Aucun serveur applicatif, aucune base de données, aucune
mesure d'audience, aucun cookie envoyé aux sites testés (`credentials: "omit"`). Les
résultats ne quittent jamais le navigateur ; le bouton **RELEVÉ** copie un texte que
vous êtes seul à transmettre, si vous le souhaitez.

---

## Utilisation

En ligne : ouvrir l'URL du déploiement, puis **Lancer le test**.

En local :

```bash
npx serve .
# puis ouvrir http://localhost:3000
```

Un simple double-clic sur `index.html` fonctionne aussi, mais certains navigateurs
restreignent les requêtes réseau depuis un fichier local (`file://`) — mieux vaut passer
par un serveur.

### Raccourcis

| Touche | Action |
|---|---|
| `Espace` | lancer / arrêter le test |
| `M` | globe 3D ↔ planisphère |
| `L` | noms ↔ badges de marque |
| `F` | plein écran |

Sur le planisphère : molette pour zoomer, glisser pour déplacer, double-clic pour
réinitialiser.

---

## Ajouter un service, ou un point d'accès

Une seule entrée dans [`assets/targets.js`](assets/targets.js), tout le reste suit —
globe, planisphère, panneau, relevé :

```js
{ name: "NOUVELLE IA", lat: 37.8, lng: -122.4, ab: "NI", color: "#ff7000",
  probes: [
    { label: "chat",  url: "https://exemple.ai", icon: "https://exemple.ai/favicon.ico" },
    { label: "agent", url: "https://agent.exemple.ai" },
  ] },
```

- `icon` doit être une image servie par le **même domaine** que `url` : c'est ce qui
  rend la sonde de contenu valide.
- `icon` est **facultatif**. Si le site renvoie `Cross-Origin-Resource-Policy:
  same-origin`, mieux vaut l'omettre : la sonde échouerait toujours sans rien
  apprendre. Vérification :
  ```bash
  curl -sI https://exemple.ai/favicon.ico | grep -i cross-origin
  ```

---

## Structure

```
index.html            page unique
assets/
  targets.js          services testés, points d'accès, témoins, canaris
  probe.js            les trois sondes, la calibration, les verdicts
  app.js              globe 3D, planisphère, panneau, relevé
  style.css
  globe.gl.min.js     librairie 3D, servie en local et non depuis un CDN
  earth-night.jpg     textures du globe
  night-sky.png
Local Test/           version d'origine : PING-LLM.bat + carte-llm.html
```

La librairie 3D et les textures sont **volontairement embarquées** plutôt que chargées
depuis `unpkg.com` : un CDN est souvent la première chose que coupe un pare-feu
d'entreprise, et un outil de diagnostic du filtrage ne peut pas dépendre de ce qu'il
mesure.

---

## Déploiement

Site statique, aucune étape de construction. Sur Vercel : importer le dépôt, choisir le
préréglage *Other*, laisser les champs de build vides.
