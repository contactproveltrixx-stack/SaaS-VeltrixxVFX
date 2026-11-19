# Croisette — installation

Ce dossier sert **une seule fois** : tu le déposes sur GitHub, et GitHub fabrique tout seul
ton application PC (`Croisette-Setup.exe`) et ta version téléphone. Tu n’as jamais à toucher au code.

## 1. Mettre le dossier sur GitHub (5 min)

1. Connecte-toi sur github.com (crée un compte gratuit si besoin).
2. En haut à droite : **+** → **New repository**. Nom : `SaaS-VeltrixxVFX`. Laisse-le **Public**
   (le contenu est chiffré : sans ton mot de passe, personne ne peut l’ouvrir). Clique **Create repository**.
3. Sur la page du dépôt : **uploading an existing file**, puis glisse **tout le contenu** de ce dossier
   (les dossiers `web`, `desktop`, `.github` et ce fichier). Clique **Commit changes**.
   - Sur Mac, le dossier `.github` est masqué dans le Finder (Cmd + Maj + . pour l’afficher).
   - S’il n’a pas été envoyé : **Add file → Create new file**, nom `.github/workflows/build.yml`,
     colle le contenu du fichier `build.yml`, puis **Commit changes**.
4. **Settings → Pages** → « Source » : choisis **GitHub Actions**.
5. Onglet **Actions** → « Croisette » → **Run workflow**. Compte environ 10 minutes.

## 2. Installer sur le PC

Quand le travail est vert dans **Actions**, va dans **Releases** (colonne de droite du dépôt) et
télécharge **Croisette-Setup.exe**. Double-clique : Croisette s’installe avec son raccourci.

Windows peut afficher « Windows a protégé votre ordinateur » (l’application n’est pas signée par
un éditeur payant) : clique **Informations complémentaires → Exécuter quand même**.
Sur Mac : clic droit sur Croisette → **Ouvrir**.

## 3. Sur le téléphone

Ouvre `https://TON-PSEUDO.github.io/SaaS-VeltrixxVFX/` :

- **iPhone** (Safari) : bouton Partager → **Sur l’écran d’accueil**.
- **Android** (Chrome) : menu ⋮ → **Installer l’application**.

Pour retrouver les mêmes données sur le PC et le téléphone, active la synchronisation :
Réglages → Connexions → GitHub (les explications sont dans l’application).

## Mises à jour

Quand Claude te fournit une nouvelle version, remplace `web/index.html` dans le dépôt
(Add file → Upload files). Le téléphone et l’application PC se mettent à jour d’eux-mêmes.
