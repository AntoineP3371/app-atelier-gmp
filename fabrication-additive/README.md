# Demandes d'impression 3D — GMP Bordeaux

Application web (fichier unique) pour gérer les demandes d'impression 3D de l'atelier GMP.
Même design et même base Supabase que `reservation-machines`.

## Ce que fait l'appli

- **Étudiant** : dépose un fichier STEP, s'identifie (nom + prénom + projet), visualise le modèle en
  3D (rotation/zoom via [Online3DViewer](https://3dviewer.net)), choisit une machine
  (Bambu Lab / Markforged) ; le **temps d'impression est estimé automatiquement** (ajustable).
- **Encadrant** : valide/refuse une demande avec un **code partagé à 4 chiffres**, puis choisit son nom.
- **Opérateur** : consulte le **tableau** des impressions (code à 4 chiffres = table `operateurs`),
  peut « Lancer » puis « Marquer terminée ». Mise à jour en temps réel.
- **Suivi étudiant** : chacun retrouve l'état de ses demandes (sans code).

## Réutilisation de l'existant

- Base Supabase **partagée** avec reservation-machines (`ggmlfbxppgeivfvlxxrj`).
- Tables **`etudiants`** (noms/prénoms/projets/encadrants) et **`operateurs`** (codes) réutilisées
  telles quelles.
- Ce projet **ajoute seulement** deux tables : `demandes` et `parametres`.

## Mise en route (pas-à-pas)

### 1. Base de données Supabase
1. Ouvrir le projet Supabase existant → **SQL Editor**.
2. Coller le contenu de [`schema.sql`](schema.sql) et **Run**. (Crée `demandes`, `parametres`,
   les policies et le realtime. Relançable sans risque.)

### 2. Stockage des fichiers sur Google Drive (Apps Script)
1. Aller sur https://script.google.com → **Nouveau projet**.
2. Coller le contenu de [`apps-script.gs`](apps-script.gs).
3. Dans votre Google Drive, créer un dossier (ex. « Impressions 3D STEP »), l'ouvrir et copier son
   **ID** (fin de l'URL `.../folders/XXXX`) → le coller dans `FOLDER_ID`.
4. **Déployer > Nouveau déploiement > Application Web** :
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
5. Copier l'**URL /exec** affichée.

### 3. Configuration de l'appli
Dans [`index.html`](index.html), en haut du `<script>` :
- `APPS_SCRIPT_URL` → coller l'URL /exec de l'étape 2.5.
- (`SUPABASE_URL` / `SUPABASE_ANON` sont déjà ceux du projet existant.)

### 4. Réglages
Ouvrir l'appli → bouton **⚙️** (code admin par défaut `0000`) :
- Définir le **code encadrant** et le **code admin**.
- Gérer la **liste des machines** proposées aux étudiants : icône, nom, débit (mm³/min) et temps
  fixe. Ajout / suppression possible ; c'est cette liste qui alimente le choix côté étudiant et le
  calcul du temps estimé.
- Ajuster le **taux de remplissage** si besoin.
- Les **opérateurs** et leurs codes se gèrent dans `reservation-machines` (table partagée).

## Notes techniques

- 100 % statique : **servez la page en http(s)** (hébergement statique, ou un petit serveur local).
  L'ouvrir en `file://` empêche le chargement du lecteur STEP (Web Worker).
- Lecteur STEP `occt-import-js` chargé automatiquement depuis le CDN par Online3DViewer.
- L'estimation de temps est **indicative** (volume × débit machine), ce n'est pas un vrai slicer.
- CORS Apps Script : l'upload utilise un POST `text/plain` (requête simple) et la relecture 3D passe
  par le `doGet` du script — à ne pas modifier.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | L'application complète |
| `schema.sql` | Tables Supabase à créer |
| `apps-script.gs` | Script Google Drive (dépôt/lecture) |
