# Gestion Liste de Présence – Commission Nationale Formation

Plateforme de pointage des participants aux séminaires de formation du **District Rotary 9101 (Côte d'Ivoire)**.

Chaque participant dispose d'un billet imprimé portant un QR Code unique. En le scannant avec son téléphone, il ouvre
`https://ef2026-cnap-ci.rotary-district9101.org/attendance=<code>` et valide sa présence à une session, sans rien installer.

| Composant | Technologie |
|---|---|
| Frontend | Next.js 15 (App Router, TypeScript, Tailwind CSS), sortie `standalone` |
| Backend | ASP.NET Core Web API .NET 8, EF Core 8 (Code First), ASP.NET Core Identity + JWT |
| Base de données | PostgreSQL (serveur externe) |
| Emails | SMTP (MailKit) via une table outbox traitée en tâche de fond |
| Déploiement | Docker Compose sur Dockploy (domaines déclarés dans Dockploy, derrière le tunnel Cloudflare existant) |

## Architecture

```
Internet ──► Cloudflare ──► tunnel du serveur ──► Traefik (Dockploy) ──► frontend:3000 (Next.js)
                                                                            └── /api/* relayé en interne ──► backend:8080
                                                                                                             └── PostgreSQL externe
```

- L'application ne dépend d'aucun nom de domaine : chaque domaine déclaré dans Dockploy sur le service `frontend`
  la sert en entier (page de scan, console, API sous `/api`). La page et l'API partagent donc toujours la même origine ;
  les jetons JWT circulent en cookies `httpOnly` (`SameSite=Lax`), propres à chaque domaine.
- Aucun port n'est publié : seul le service `frontend` reçoit du trafic, via Traefik. Le backend n'est joignable que
  sur le réseau Docker interne.
- La base de données est un serveur PostgreSQL externe (variables `POSTGRES_*`) : le compose ne contient pas de
  conteneur de base.
- L'IP réelle du participant (`CF-Connecting-IP`, sinon `X-Forwarded-For`) est transmise jusqu'au backend pour la
  limitation de débit.
- Le middleware Next.js réécrit en interne `/attendance=<code>` vers la page de scan : l'URL imprimée sur les billets
  reste celle affichée dans le navigateur.

```
backend/
  src/Cnap.Attendance.Core/            entités, DTOs, validateurs FluentValidation, exceptions métier
  src/Cnap.Attendance.Infrastructure/  DbContext, migrations, Identity, services, SMTP + outbox, import, seed
  src/Cnap.Attendance.Api/             contrôleurs, authentification JWT, rate limiting, Program.cs
frontend/
  src/middleware.ts                    réécriture /attendance=… et garde /admin
  src/app/scan/[code]/                 page publique mobile
  src/app/admin/                       console d'administration
  src/components/table-donnees.tsx     tableau commun : tri, filtres de colonnes, pagination, exports
  src/lib/export.ts                    exports CSV, Excel et PDF générés dans le navigateur
docker-compose.yml                     stack de production (Dockploy)
docker-compose.local.yml               surcharge pour tester sur Docker Desktop
```

## Règles métier principales

- **Premier scan** (QR Code `Inactif`) : le participant choisit son club, le séminaire (présélectionné s'il n'y en a
  qu'un), la session, saisit nom et email. Le QR Code passe `Actif` et une présence est enregistrée.
- **Scans suivants** : le participant est reconnu (nom, club et email masqué affichés) ; il choisit la session.
- **Une seule présence par QR Code et par session**, garantie par une contrainte d'unicité en base
  (`ux_presences_qr_code_session`) ; un double scan renvoie « Présence déjà enregistrée pour cette session à HH:MM ».
- Les sessions ouvertes au pointage sont celles marquées **actives** (ouverture et fermeture manuelles, aucun blocage
  horaire). Un séminaire actif sans session active n'est pas proposé.
- **Les QR Codes ne sont jamais réinitialisés** : l'historique est conservé. Un Administrateur peut corriger le nom,
  l'email ou le club d'un participant (erreur de saisie).
- **L'email de confirmation ne bloque jamais le pointage** : il est écrit dans `email_outbox` dans la même transaction
  que la présence, puis envoyé en tâche de fond avec reprises espacées (1 min, 5 min, 15 min, 1 h, 4 h).
- Les heures sont stockées en UTC et affichées dans le fuseau `Africa/Abidjan` (UTC+0).

### Contrôle du lieu de la formation

Pour vérifier que les participants valident leur présence sur place, chaque séminaire peut activer un contrôle de
position (Séminaires > Modifier > « Lieu de la formation ») :

| Mode | Effet |
|---|---|
| Désactivé | La position n'est pas demandée. |
| Signaler les présences hors zone | La présence est toujours enregistrée, marquée « Sur place », « Hors zone » ou « Non localisée ». |
| Refuser les présences hors zone | La validation est refusée hors zone ou si le participant ne partage pas sa position. |

- Le lieu se définit par ses coordonnées GPS (copiées depuis Google Maps ou prises sur place avec « Utiliser ma
  position actuelle ») et un rayon de 50 à 500 m. Une marge de 100 m au plus s'ajoute selon la précision annoncée par
  le téléphone, le GPS étant moins précis en intérieur.
- Le parcours du participant ne change pas : sa position est demandée au clic sur « Valider ma présence », avec une
  mention expliquant pourquoi. Seules la distance au lieu et la précision sont enregistrées, jamais les coordonnées.
- La colonne « Lieu » des présences permet de filtrer et d'exporter les présences à vérifier.
- Commencer par le mode « Signaler » : il ne bloque aucun participant et montre si des présences hors zone existent.
  La position d'un téléphone peut être falsifiée avec une application dédiée : le contrôle dissuade et trace, il ne
  constitue pas une preuve absolue.
- Un même téléphone peut valider plusieurs billets (aide aux participants peu à l'aise avec le numérique).

## Test local complet (Docker Desktop)

```bash
cp .env.example .env
# Pour un test local, ajuster dans .env :
#   POSTGRES_HOST=db          (PostgreSQL de test fourni par docker-compose.local.yml)
#   COOKIE_SECURE=false
#   et renseigner POSTGRES_PASSWORD, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

| URL | Rôle |
|---|---|
| http://localhost:3000/attendance=2925AK7VAGNBS34PQD87 | Page de scan (après import des codes) |
| http://localhost:3000/admin | Console d'administration |
| http://localhost:8025 | Mailpit : boîte de réception capturant tous les emails envoyés |

La surcharge locale ajoute un PostgreSQL de test (jamais utilisé en production), publie les ports et configure le
SMTP vers Mailpit.

## Console d'administration : listes et exports

Toutes les listes (séminaires, sessions, clubs, QR Codes, présences, utilisateurs, historique d'un participant,
tableaux du tableau de bord) partagent le même fonctionnement :

- actions de ligne en icônes à gauche, avec infobulle ;
- tri en cliquant sur l'en-tête de colonne (croissant, décroissant, sans tri) ;
- filtre sous chaque en-tête : saisie libre (sans tenir compte des accents ni de la casse) ou liste des valeurs ;
- pagination de 10, 30, 50 ou 100 lignes ;
- exports **CSV, Excel et PDF** de la vue affichée : les filtres et le tri sont appliqués, toutes les pages sont
  exportées, et les filtres actifs sont rappelés en tête du PDF.

Le tableau de bord s'exporte aussi en un seul PDF (graphiques et tableaux) avec le bouton « Exporter en PDF ».
Les exports sont générés dans le navigateur.

## Première mise en service

1. Se connecter sur `/admin` avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`, puis **choisir un nouveau mot de passe** (imposé).
2. **QR Codes > Importer** : charger le fichier des codes (`docs/codes_seminaire.xlsx`, colonne `Code` ; les autres
   colonnes sont ignorées). Un réimport ne crée pas de doublon. Ce fichier et le PDF des billets sont exclus de git
   (`.gitignore`) : ils permettraient d'activer le billet d'un participant.
3. **Clubs** : importer la liste des clubs (CSV, `.xlsx` ou `.xls`, colonnes `Code` et `Nom` ; un modèle est
   téléchargeable depuis la fenêtre d'import) ou les saisir, puis
   **désactiver le « Club de démonstration »** créé par le seed.
4. **Séminaires / Sessions** : vérifier le séminaire créé par le seed (« Séminaire Effectif D9101 ») et créer les
   sessions réelles ; seules les sessions **ouvertes** sont proposées aux participants.
5. **Paramètres email** : renseigner le serveur SMTP puis cliquer sur « Envoyer un email de test ».
6. Scanner un billet de test avec un téléphone et vérifier la réception de l'email de confirmation.

## Déploiement sur Dockploy

Même fonctionnement que les autres applications du serveur : le tunnel Cloudflare existant envoie le trafic à Dockploy,
et les domaines se déclarent dans Dockploy. Aucun jeton ni conteneur `cloudflared` n'est nécessaire ici.

1. **Dans Dockploy** : créer un service **Docker Compose** pointant vers ce dépôt Git (branche `main`, fichier
   `docker-compose.yml`).
2. Onglet **Environment** : saisir les variables de [.env.example](.env.example) avec des valeurs de production :
   - `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` : le serveur PostgreSQL
     externe. La base doit exister (ou l'utilisateur doit avoir le droit `CREATEDB`) ; les tables sont créées au
     démarrage. Le serveur doit être joignable depuis le conteneur `backend` ;
   - `JWT_SECRET` : valeur aléatoire forte (`openssl rand -base64 48`) ;
   - `COOKIE_SECURE=true` ;
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. Onglet **Domains** : ajouter chaque domaine sur le service **`frontend`**, port **`3000`**, chemin `/`, avec les
   mêmes réglages HTTPS/certificat que les autres applications derrière le tunnel. Par exemple :

   | Domaine | Service | Port |
   |---|---|---|
   | `ef2026-cnap-ci.rotary-district9101.org` (formation effectif) | `frontend` | 3000 |
   | `sf2026-cnap-ci.rotary-district9101.org` (formation fondation) | `frontend` | 3000 |
   | `attendance-cnap-ci.rotary-district9101.org` (formations génériques) | `frontend` | 3000 |

   Ne pas déclarer de domaine sur `backend`.
4. Dans Cloudflare, faire pointer ces sous-domaines vers le tunnel existant, comme pour les autres applications.
5. Déployer. Au démarrage, le backend applique les migrations puis crée les rôles, le compte administrateur et les
   données de démarrage (si les tables sont vides).
6. Vérifier `https://<domaine>/api/health` → `{"statut":"ok"}`.

### Plusieurs formations : une instance ou plusieurs ?

- **Une seule instance avec les trois domaines** : une base commune (QR Codes, clubs, utilisateurs, rapports). Les
  participants voient les séminaires **actifs** au moment du scan, quel que soit le domaine : il suffit d'activer le
  séminaire de la formation en cours.
- **Une instance par formation** : déployer ce même dépôt dans trois services Docker Compose distincts (chacun avec
  sa base, ses variables et son domaine). Les données, les comptes et les codes sont alors totalement séparés.

### Mot de passe administrateur oublié

Dans l'onglet **Environment** du service Dockploy :

1. `ADMIN_RESET=true`, `ADMIN_EMAIL` = le compte à débloquer, `ADMIN_PASSWORD` = un mot de passe provisoire
   (8 caractères minimum, avec majuscule, minuscule et chiffre) ;
2. **redéployer** : au démarrage, le compte est créé s'il n'existe pas ; sinon son mot de passe est remplacé, il est
   réactivé, déverrouillé, remis au rôle Administrateur, et ses sessions ouvertes sont fermées ;
3. se connecter avec le mot de passe provisoire (un nouveau mot de passe est alors imposé) ;
4. repasser `ADMIN_RESET=false`.

La réinitialisation n'est appliquée **qu'une fois par valeur de `ADMIN_PASSWORD`** : si `ADMIN_RESET=true` reste en
place, un redémarrage n'écrase pas le mot de passe choisi entre-temps. Pour réinitialiser à nouveau, changer
`ADMIN_PASSWORD`. Les journaux du backend confirment l'opération (`Compte administrateur … réinitialisé`).

### Variables d'environnement

Toutes les variables sont documentées dans [.env.example](.env.example). Les secrets (mot de passe PostgreSQL, secret
JWT, identifiants SMTP) ne sont jamais écrits dans le code.

Le mot de passe SMTP saisi dans la console est chiffré en base (ASP.NET Data Protection) ; les clés de chiffrement sont
elles-mêmes stockées en base (`data_protection_keys`) et survivent donc aux redéploiements des conteneurs.

## Base de données et migrations

Les migrations EF Core versionnées se trouvent dans `backend/src/Cnap.Attendance.Infrastructure/Data/Migrations`.
Elles sont appliquées automatiquement au démarrage (`Database__MigrateOnStartup=true`).

```bash
cd backend
# Nouvelle migration après modification du modèle
dotnet ef migrations add NomDeLaMigration -p src/Cnap.Attendance.Infrastructure -s src/Cnap.Attendance.Infrastructure -o Data/Migrations
# Script SQL idempotent (pour une application manuelle)
dotnet ef migrations script --idempotent -p src/Cnap.Attendance.Infrastructure -s src/Cnap.Attendance.Infrastructure -o migrations.sql
```

**Sauvegarde** :

```bash
pg_dump -h <POSTGRES_HOST> -p <POSTGRES_PORT> -U <POSTGRES_USER> -d <POSTGRES_DB> -Fc > sauvegarde-$(date +%Y%m%d-%H%M).dump
```

## Développement sans Docker

```bash
# Base PostgreSQL seule
docker run -d --name cnap-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=cnap_attendance -p 55432:5432 postgres:16-alpine

# API (http://localhost:5080)
cd backend/src/Cnap.Attendance.Api
export ConnectionStrings__Default="Host=localhost;Port=55432;Database=cnap_attendance;Username=postgres;Password=devpass"
export Jwt__Secret="un-secret-de-developpement-d-au-moins-32-caracteres"
export Seed__AdminEmail="admin@cnap.local" Seed__AdminMotDePasse="Admin12345"
dotnet run

# Frontend (http://localhost:3000) — /api est relayé vers http://localhost:5080
cd frontend && npm install && npm run dev
```

## Sécurité

- Routes `/api/admin/*` protégées par JWT : rôle Administrateur ou Gestionnaire, et mot de passe initial changé.
  Paramètres, utilisateurs, import des QR Codes et correction des participants sont réservés aux Administrateurs.
- Refresh tokens stockés hachés (SHA-256), rotation à chaque usage et révocation de la famille en cas de réutilisation.
- Verrouillage du compte 15 minutes après 5 échecs de connexion ; connexion limitée à 10 requêtes par minute et par IP.
- Page de scan : format du code validé (20 caractères alphanumériques) côté client et serveur, réponse identique pour
  un code mal formé ou inconnu, rate limiting par IP (`CF-Connecting-IP`, sinon `X-Forwarded-For`). La limite reste large (300/min par défaut)
  car de nombreux participants partagent la même IP publique (Wi-Fi de l'hôtel, NAT des opérateurs mobiles) ;
  l'espace des codes (31^20) rend l'énumération irréaliste.
- Aucune origine externe autorisée par défaut (CORS) : la page et l'API sont toujours servies par le même domaine.
  `PUBLIC_URLS` permet d'en ajouter si un autre site doit appeler l'API.
- Exports CSV protégés contre l'injection de formules.
