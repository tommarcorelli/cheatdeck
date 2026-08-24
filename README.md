# cheat/deck

Cheatsheet de commandes pour 59 systèmes et outils — Linux (Debian, Arch,
Fedora et dérivées), BSD, macOS, Windows, plus les outils du quotidien
(Bash, grep/sed/awk, curl, jq, rsync, Nmap, OpenSSL, nftables, Git, Docker,
Kubernetes, Terraform, Ansible, tmux, Vim, systemd, Python…).

Plus de 5 300 commandes, cherchables et copiables en un clic.
Aucun compte, aucun tracker, aucun backend : tout tourne dans le navigateur.

## Ce qu'on peut faire

- **Chercher** dans le système affiché, avec tolérance aux fautes de frappe,
  ou dans les 59 systèmes à la fois avec <kbd>Ctrl</kbd> + <kbd>K</kbd>.
  Les termes trouvés sont surlignés dans les résultats.
- **Réviser** : le deck pose l'action, à toi de retrouver la commande. Les
  cartes ratées reviennent plus souvent, et le score reste sur ta machine.
- **Épingler** des commandes de n'importe quel système dans une liste unique,
  exportable et réimportable en JSON.
- **Comparer** deux systèmes côte à côte (apt contre pacman contre dnf…).
- Les commandes irréversibles (rm -rf, terraform destroy, rsync --delete…)
  portent un avertissement.
- Une note explique le piège ou le drapeau utile sur près des deux tiers
  des commandes.
- **Exporter** une cheatsheet complète en Markdown, ou l'imprimer.
- **Consulter hors-ligne** : l'application est une PWA installable.

## Raccourcis clavier

| Touche | Effet |
| --- | --- |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | recherche globale |
| <kbd>Ctrl</kbd> + <kbd>↵</kbd> | copier le résultat sélectionné sans quitter la recherche |
| <kbd>←</kbd> <kbd>→</kbd> | changer de système |
| <kbd>R</kbd> | mode révision |
| <kbd>Espace</kbd> / <kbd>1</kbd> / <kbd>2</kbd> | révéler / à revoir / je savais |
| <kbd>?</kbd> | liste des raccourcis |

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | structure de la page et des modales |
| `data.js` | les 5 000+ commandes, les métadonnées des systèmes et les catégories |
| `icons.js` | logos officiels (Simple Icons), chargés après le premier rendu |
| `app.js` | état, rendu, recherche, favoris, comparaison, révision |
| `style.css` | thème sombre par défaut, thème clair, impression |
| `sw.js` | service worker (consultation hors-ligne) |

## Développement

Le site est en HTML/CSS/JS sans dépendance ni étape de build. Un serveur
statique suffit :

```
python -m http.server 8000
```

À chaque modification de `app.js`, `data.js`, `icons.js` ou `style.css`,
penser à remonter la version (`?v=…` dans `index.html` et `CACHE_VERSION`
dans `sw.js`) pour que le cache des visiteurs se renouvelle.

## Licence

MIT — voir [LICENSE](LICENSE).
