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

Le test repose donc sur **deux sondes indépendantes** par service, puis sur leur
croisement.

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
une image : le vrai serveur a répondu. Un portail de blocage, lui, renvoie du HTML — le
décodage échoue.

### 3. Calibration

Trois domaines d'infrastructure neutres (Cloudflare, Wikipedia, Microsoft) sont mesurés
en premier. Ils donnent :

- la **latence normale** du réseau, pour repérer ensuite une réponse trop rapide pour
  être venue de l'autre bout du monde — signe d'un équipement local qui répond à la
  place du serveur ;
- un **garde-fou** : si la sonde contenu échoue même sur ces témoins, c'est le
  navigateur ou une extension qui la bloque, pas les IA. Le moteur la désactive alors
  et le signale, au lieu d'accuser seize sites à tort.

### Table de décision

| Paquet sort | Image authentique | Verdict | Confiance |
|---|---|---|---|
| oui | oui | **Ouvert** | haute |
| oui | non, réponse instantanée | **Filtré** — portail de blocage | haute |
| oui | non, délai normal | **Filtré** | moyenne |
| non | oui | **Filtré** — filtrage par URL | moyenne |
| non | non, refus immédiat | **Coupé** — DNS ou reset | haute |
| non | non, délai expiré | **Coupé** — paquets absorbés | haute |

Chaque ligne du panneau affiche son niveau de confiance (`●` à `●●●`) et, au survol, le
détail des deux sondes.

---

## Limites — à lire avant de conclure

- **Pas de lecture de la page de blocage.** Le verdict repose sur des indices, pas sur
  une preuve. Un proxy qui renvoie sa page d'erreur en HTTP 200 avec une vraie image
  peut passer pour un site ouvert.
- **« Filtré » ne veut pas dire « votre entreprise l'a décidé ».** Le service peut être
  en panne, ou refuser votre pays. Sans test de référence côté serveur, les deux cas
  sont indiscernables ; le site ne prétend pas trancher.
- **Un service joignable n'est pas un service utilisable.** La page d'accueil peut
  répondre alors que la connexion au compte, elle, est bloquée.
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

## Ajouter un service à tester

Une seule entrée dans [`assets/targets.js`](assets/targets.js), tout le reste suit —
globe, planisphère, panneau, relevé :

```js
{ name: "NOUVELLE IA", url: "https://exemple.ai",
  icon: "https://exemple.ai/favicon.ico",
  lat: 37.8, lng: -122.4, ab: "NI", color: "#ff7000" },
```

`icon` doit être une image servie par le **même domaine** que `url` : c'est ce qui rend
la sonde de contenu valide.

---

## Structure

```
index.html            page unique
assets/
  targets.js          liste des services testés + témoins de calibration
  probe.js            moteur : les deux sondes, la calibration, le verdict
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
