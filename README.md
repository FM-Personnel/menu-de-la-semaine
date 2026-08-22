# Menu de la semaine

Calendrier hebdomadaire de repas (Lundi→Dimanche × Déjeuner/Dîner), HTML/CSS/JS
vanilla, sans backend. Les données restent dans le `localStorage` du navigateur —
aucun compte, aucune dépendance à une API externe.

## Déploiement (choisir une option)

### Option A — Netlify Drop (le plus rapide, aucun compte requis)

1. Aller sur https://app.netlify.com/drop dans un navigateur.
2. Glisser-déposer le dossier `menu-de-la-semaine` (celui-ci) dans la zone de dépôt.
3. Netlify donne immédiatement une URL `https://un-nom-aleatoire.netlify.app`.
4. (Optionnel, recommandé) Créer un compte Netlify gratuit pour "réclamer" le site
   et garder la même URL durablement, sinon un site non réclamé peut expirer.

### Option B — GitHub Pages (URL stable liée à un repo, versionné)

1. Créer un repo sur https://github.com/new (ex. `menu-de-la-semaine`), public.
2. Depuis ce dossier :
   ```bash
   git remote add origin https://github.com/<votre-compte>/menu-de-la-semaine.git
   git branch -M main
   git push -u origin main
   ```
3. Sur GitHub : Settings → Pages → Source = `main` branch, dossier `/ (root)`.
4. L'app sera visible sur `https://<votre-compte>.github.io/menu-de-la-semaine/`
   après 1-2 minutes.

### Option C — Vercel

Nécessite Node.js installé localement (`npm i -g vercel`, puis `vercel` dans ce
dossier), ou passer par l'import GitHub sur vercel.com après l'option B.

## Test après déploiement

1. Ouvrir l'URL https, taper un plat dans une case.
2. Recharger complètement la page → le plat doit rester.
3. Fermer le navigateur, rouvrir plus tard → toujours là (test réel de
   `localStorage`, indépendant de tout serveur).
4. Sur Android/Chrome : menu ⋮ → "Ajouter à l'écran d'accueil".
5. Couper le Wi-Fi après un premier chargement → l'app doit encore s'ouvrir
   (grâce au service worker `sw.js` qui met en cache l'app shell).

## Limite connue

Le stockage est local au navigateur/appareil : un plat tapé sur le téléphone
n'apparaît pas automatiquement sur une tablette ou un autre navigateur. Si ce
besoin apparaît plus tard, une synchronisation multi-appareils sans compte
(ex. petit backend + "code de partage") peut être ajoutée par-dessus cette
base sans tout reconstruire.
