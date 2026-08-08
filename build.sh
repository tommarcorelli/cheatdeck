#!/usr/bin/env bash
# build.sh — génère une version de production minifiée dans dist/.
#
# Ce script est OPTIONNEL. Les fichiers à la racine (index.html, app.js,
# style.css, data.js...) restent la source de vérité, éditée directement —
# ce script ne les modifie jamais. Il produit une copie dans dist/ avec
# app.js et style.css minifiés (gain mesuré : ~20% sur ces deux fichiers
# une fois gzippés ; data.js n'est volontairement PAS minifié, le gain est
# négligeable car c'est surtout du texte français, pas de la syntaxe JS).
#
# Usage :
#   ./build.sh
#   → déploie le contenu de dist/ au lieu de la racine si tu veux la
#     version optimisée. Sinon la racine seule fonctionne très bien telle
#     quelle (le service worker cache tout après la première visite).
#
# Prérequis : Node.js + npm.

set -euo pipefail
cd "$(dirname "$0")"

echo "→ Installation des outils de minification (temporaire)..."
npm install --no-save --silent terser csso-cli

rm -rf dist
mkdir -p dist/icons

echo "→ Minification app.js et style.css..."
npx terser app.js -c -m -o dist/app.js
npx csso style.css -o dist/style.css

echo "→ Copie des fichiers inchangés (data.js, sw.js, manifest, icônes, assets)..."
cp data.js sw.js manifest.json favicon.svg og-image.jpg robots.txt dist/
cp icons/*.png dist/icons/

echo "→ Génération de dist/index.html (mêmes chemins de fichiers, contenu identique)..."
cp index.html dist/index.html

echo "→ Nettoyage des dépendances temporaires..."
rm -rf node_modules package-lock.json package.json

before=$(du -ch app.js style.css | tail -1 | cut -f1)
after=$(du -ch dist/app.js dist/style.css | tail -1 | cut -f1)
echo ""
echo "Terminé. dist/ prêt à déployer (app.js+style.css: $before → $after)."
echo "N'oublie pas de bumper CACHE_VERSION dans sw.js avant de publier si tu as changé du contenu."
