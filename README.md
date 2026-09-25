# Gestion Liste de Présence – Commission Nationale Formation

Plateforme de pointage des participants aux séminaires de formation du **District Rotary 9101 (Côte d'Ivoire)**.

Chaque participant dispose d'un billet imprimé portant un QR Code unique. En le scannant avec son téléphone, il ouvre
`https://ef2026-cnap-ci.rotary-district9101.org/attendance=<code>` et valide sa présence à une session, sans rien installer.

| Composant | Technologie |
|---|---|
| Frontend | Next.js 15 (App Router, TypeScript, Tailwind CSS), sortie `standalone` |
| Backend | ASP.NET Core Web API .NET 8, EF Core 8 (Code First), ASP.NET Core Identity + JWT |
| Base de données | PostgreSQL 16 |
| Emails | SMTP (MailKit) via une table outbox traitée en tâche de fond |
| Déploiement | Docker Compose sur Dockploy, exposition via Cloudflare Tunnel |

## Architecture

```
Internet ──► Cloudflare ──► cloudflared (tunnel)
                               ├── /api/*       ──► backend:8080  (ASP.NET Core)
                               └── tout le reste ──► frontend:3000 (Next.js)
                                                     backend ──► db:5432 (PostgreSQL)
```

- Un seul nom de domaine : le frontend et l'API partagent la même origine, les jetons JWT circulent en cookies
  `httpOnly` (`SameSite=Lax`).
- Aucun port n'est publié en production : seul `cloudflared` sort vers Internet.
- Le middleware Next.js réécrit en interne `/attendance=<code>` vers la page de scan : l'URL imprimée sur les billets
  reste celle affichée dans le navigateur.

```
backend/
  src/Cnap.Attendance.Core/            entités, DTOs, validateurs FluentValidation, exceptions métier
  src/Cnap.Attendance.Infrastructure/  DbContext, migrations, Identity, services, SMTP + outbox, import/export, seed
  src/Cnap.Attendance.Api/             contrôleurs, authentification JWT, rate limiting, Program.cs
frontend/
  src/middleware.ts                    réécriture /attendance=… et garde /admin
  src/app/scan/[code]/                 page publique mobile
  src/app/admin/                       console d'administration
deploy/cloudflared/config.yml          variante « tunnel géré par fichier »
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

## Test local complet (Docker Desktop)

```bash
cp .env.example .env
# Pour un test local, ajuster dans .env :
#   PUBLIC_URL=http://localhost:3000
#   COOKIE_SECURE=false
#   et renseigner POSTGRES_PASSWORD, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

| URL | Rôle |
|---|---|
| http://localhost:3000/attendance=2925AK7VAGNBS34PQD87 | Page de scan (après import des codes) |
| http://localhost:3000/admin | Console d'administration |
| http://localhost:8025 | Mailpit : boîte de réception capturant tous les emails envoyés |

La surcharge locale publie les ports, désactive le tunnel et configure le SMTP vers Mailpit.

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

1. **Créer le tunnel Cloudflare** (Cloudflare Zero Trust > Networks > Tunnels > Create a tunnel > Cloudflared).
   Copier le **jeton** affiché dans la commande Docker (`--token eyJ...`).
2. Dans le tunnel, onglet **Public Hostname**, ajouter **dans cet ordre** :

   | Sous-domaine | Domaine | Path | Service |
   |---|---|---|---|
   | `ef2026-cnap-ci` | `rotary-district9101.org` | `^/api/` | `http://backend:8080` |
   | `ef2026-cnap-ci` | `rotary-district9101.org` | *(vide)* | `http://frontend:3000` |

   Cloudflare crée l'enregistrement DNS et gère le certificat HTTPS.
3. **Dans Dockploy** : créer un projet, puis un service **Docker Compose** pointant vers ce dépôt Git
   (branche `main`, fichier `docker-compose.yml`).
4. Dans l'onglet **Environment** du service, saisir les variables de `.env.example` avec des valeurs de production :
   - `POSTGRES_PASSWORD` et `JWT_SECRET` : valeurs aléatoires fortes (`openssl rand -base64 48`) ;
   - `PUBLIC_URL=https://ef2026-cnap-ci.rotary-district9101.org` ;
   - `COOKIE_SECURE=true` ;
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` ;
   - `CLOUDFLARE_TUNNEL_TOKEN` : le jeton de l'étape 1.
5. **Ne pas attribuer de domaine Dockploy/Traefik** aux services : l'exposition passe uniquement par le tunnel.
6. Déployer. Au démarrage, le backend applique les migrations puis crée les rôles, le compte administrateur et les
   données de démarrage (si les tables sont vides).
7. Vérifier `https://ef2026-cnap-ci.rotary-district9101.org/api/health` → `{"statut":"ok"}`.

> Le tunnel doit pouvoir joindre `backend` et `frontend` par leur nom de service : `cloudflared` est déclaré dans le
> même fichier Compose, donc sur le même réseau Docker.

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
JWT, identifiants SMTP, jeton du tunnel) ne sont jamais écrits dans le code.

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
docker compose exec db pg_dump -U cnap -d cnap_attendance -Fc > sauvegarde-$(date +%Y%m%d-%H%M).dump
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
  un code mal formé ou inconnu, rate limiting par IP (`CF-Connecting-IP`). La limite reste large (300/min par défaut)
  car de nombreux participants partagent la même IP publique (Wi-Fi de l'hôtel, NAT des opérateurs mobiles) ;
  l'espace des codes (31^20) rend l'énumération irréaliste.
- CORS limité à `PUBLIC_URL`.
- Exports CSV protégés contre l'injection de formules.
