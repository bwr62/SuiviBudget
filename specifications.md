\# CAHIER DES CHARGES TECHNIQUE \& FONCTIONNEL : APPLICATION DE GESTION DE BUDGET (PC)



\## 0. DIRECTIVES CRITIQUES POUR L'AGENT IA (GEMINI 3.8 FLASH)



> \*\*RÈGLE ABSOLUE N°1 : Maintien de `knowledge.md` en temps réel.\*\*

> À chaque étape de création, modification ou suppression de fichier, l'agent \*\*DOIT OBLIGATOIREMENT\*\* créer et mettre à jour le fichier `knowledge.md` à la racine du projet. Aucune tâche n'est considérée comme terminée tant que `knowledge.md` n'est pas synchronisé.



\### Structure imposée pour `knowledge.md` :



1\. \*\*Architecture globale \& Stack\*\* : État actuel des dépendances et structure des dossiers.

2\. \*\*Registre des Fichiers\*\* : Tableau listant chaque fichier (`Chemin | Rôle exact | Fonctions/Composants exportés | Dépendances internes`).

3\. \*\*Schéma de Base de Données \& Flux\*\* : État des tables SQLite, index, et logique des requêtes SQL.

4\. \*\*Logique Métier Critique\*\* : Explication détaillée du moteur de report mensuel, du calcul des totaux (exclusion des statuts `PENDING`), et du flux d'authentification WebAuthn/JWT.

5\. \*\*Journal des Modifications (Changelog)\*\* : Historique chronologique des fonctionnalités implémentées pour audit et reprise de code.



\### Comportement de codage attendu :



\* \*\*Typage strict\*\* : TypeScript strict (`noImplicitAny`, interfaces partagées entre Front et Back).

\* \*\*Zéro code mort ou placeholder\*\* : Pas de commentaires `// TODO: implement later`. Chaque brique codée doit être fonctionnelle.

\* \*\*Isolation\*\* : Un composant = une responsabilité. Séparer clairement les contrôleurs API, les services SQL et l'interface React.



\---



\## 1. ARCHITECTURE TECHNIQUE \& STACK



\### Frontend (Client Desktop uniquement - Résolution cible : 1280px à 2560px)



\* \*\*Framework\*\* : React 18+ avec Vite et TypeScript.

\* \*\*Style \& UI\*\* : Tailwind CSS + \*\*shadcn/ui\*\* (ou Radix UI) pour une esthétique moderne, sombre/clair (Dark Mode par défaut inspiré de \*Linear\*, \*Copilot Money\* et \*Finary\*).

\* \*\*Icônes\*\* : `lucide-react`.

\* \*\*Graphiques\*\* : `recharts` (performant et modulable pour les statistiques).

\* \*\*Gestion d'état \& Data Fetching\*\* : `@tanstack/react-query` (synchronisation cache/API instantanée) + `zustand` (état UI global : mois sélectionné, filtres).



\### Backend \& Base de Données



\* \*\*Runtime \& Serveur\*\* : Node.js avec Express (TypeScript).

\* \*\*Base de données\*\* : SQLite via `better-sqlite3` (synchrone, ultra-rapide en local, gestion native des transactions ACID).

\* \*\*Validation des données\*\* : `zod` (validation stricte des payloads entrants sur l'API).



\---



\## 2. NORMES DE SÉCURITÉ MAXIMALES



1\. \*\*Authentification Passwordless (Passkeys / WebAuthn)\*\* :

\* Implémentation via `@simplewebauthn/server` et `@simplewebauthn/browser`.

\* Stockage des clés publiques et du compteur de signatures en base SQLite pour prévenir le clonage.

\* Code de secours maître (Recovery Hash via `Argon2id`) généré à l'initialisation.





2\. \*\*Session \& JWT\*\* :

\* Secret JWT (`JWT\_SECRET`) généré cryptographiquement avec \*\*minimum 32 caractères aléatoires\*\* (256 bits d'entropie minimum), vérifié au démarrage du serveur (crash volontaire si inférieur à 32 caractères).

\* Stockage du JWT uniquement dans un cookie `HttpOnly`, `Secure`, `SameSite=Strict`.

\* Rotation de token : Access Token (15 min) + Refresh Token (7 jours, stocké et révocable en base).





3\. \*\*Protection Applicative \& Base de données\*\* :

\* Requêtes SQL \*\*100% préparées (Prepared Statements)\*\* pour éliminer toute injection SQL.

\* Middleware `helmet` (CSP stricte), `cors` verrouillé sur l'origine locale, et `express-rate-limit` sur les routes d'authentification.







\---



\## 3. SCHÉMA DE BASE DE DONNÉES (SQLite)



L'agent doit initialiser la base avec les tables suivantes :



```sql

\-- 1. Utilisateurs \& Sécurité

CREATE TABLE users (

&#x20;   id TEXT PRIMARY KEY,

&#x20;   username TEXT UNIQUE NOT NULL,

&#x20;   recovery\_hash TEXT NOT NULL,

&#x20;   created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP

);



CREATE TABLE passkeys (

&#x20;   credential\_id TEXT PRIMARY KEY,

&#x20;   user\_id TEXT NOT NULL,

&#x20;   public\_key BLOB NOT NULL,

&#x20;   counter INTEGER NOT NULL DEFAULT 0,

&#x20;   transports TEXT, -- JSON array

&#x20;   created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,

&#x20;   FOREIGN KEY (user\_id) REFERENCES users(id) ON DELETE CASCADE

);



\-- 2. Catégories et Sous-catégories

CREATE TABLE categories (

&#x20;   id TEXT PRIMARY KEY,

&#x20;   name TEXT NOT NULL,

&#x20;   type TEXT NOT NULL CHECK(type IN ('INCOME', 'RECURRING\_EXPENSE', 'CURRENT\_EXPENSE', 'UNFORESEEN\_EXPENSE')),

&#x20;   icon TEXT NOT NULL, -- Nom de l'icône Lucide

&#x20;   color TEXT NOT NULL, -- Code Hex ou classe Tailwind

&#x20;   is\_system INTEGER DEFAULT 0, -- 1 = pré-créée, 0 = personnalisée

&#x20;   is\_active INTEGER DEFAULT 1

);



CREATE TABLE subcategories (

&#x20;   id TEXT PRIMARY KEY,

&#x20;   category\_id TEXT NOT NULL,

&#x20;   name TEXT NOT NULL,

&#x20;   FOREIGN KEY (category\_id) REFERENCES categories(id) ON DELETE CASCADE

);



\-- 3. Modèles d'opérations récurrentes (Moteur de répétition)

CREATE TABLE recurring\_templates (

&#x20;   id TEXT PRIMARY KEY,

&#x20;   title TEXT NOT NULL,

&#x20;   amount REAL NOT NULL,

&#x20;   type TEXT NOT NULL CHECK(type IN ('INCOME', 'RECURRING\_EXPENSE', 'CURRENT\_EXPENSE')),

&#x20;   category\_id TEXT NOT NULL,

&#x20;   subcategory\_id TEXT,

&#x20;   day\_of\_month INTEGER NOT NULL CHECK(day\_of\_month BETWEEN 1 AND 31),

&#x20;   status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PENDING\_PAUSED')),

&#x20;   carry\_over INTEGER NOT NULL DEFAULT 1, -- 1 = se reporte sur les mois suivants

&#x20;   created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,

&#x20;   FOREIGN KEY (category\_id) REFERENCES categories(id),

&#x20;   FOREIGN KEY (subcategory\_id) REFERENCES subcategories(id)

);



\-- 4. Transactions mensuelles réelles (Instances par mois)

CREATE TABLE transactions (

&#x20;   id TEXT PRIMARY KEY,

&#x20;   template\_id TEXT, -- NULL si dépense imprévue ou ponctuelle

&#x20;   month\_year TEXT NOT NULL, -- Format 'YYYY-MM' (ex: '2026-10')

&#x20;   date TEXT NOT NULL, -- Format 'YYYY-MM-DD'

&#x20;   title TEXT NOT NULL,

&#x20;   amount REAL NOT NULL,

&#x20;   type TEXT NOT NULL CHECK(type IN ('INCOME', 'RECURRING\_EXPENSE', 'CURRENT\_EXPENSE', 'UNFORESEEN\_EXPENSE')),

&#x20;   category\_id TEXT NOT NULL,

&#x20;   subcategory\_id TEXT,

&#x20;   status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PENDING')),

&#x20;   is\_carried\_over INTEGER DEFAULT 0, -- 1 si générée par report automatique

&#x20;   notes TEXT,

&#x20;   created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,

&#x20;   FOREIGN KEY (template\_id) REFERENCES recurring\_templates(id) ON DELETE SET NULL,

&#x20;   FOREIGN KEY (category\_id) REFERENCES categories(id),

&#x20;   FOREIGN KEY (subcategory\_id) REFERENCES subcategories(id)

);



\-- 5. Clôtures et Reports de Solde Mensuel

CREATE TABLE monthly\_balances (

&#x20;   month\_year TEXT PRIMARY KEY, -- 'YYYY-MM'

&#x20;   carried\_over\_from\_previous REAL DEFAULT 0, -- Reliquat ou dette du mois M-1

&#x20;   is\_closed INTEGER DEFAULT 0

);



```



\---



\## 4. RÈGLES MÉTIER CRITIQUES (REPORT \& ÉTATS "EN ATTENTE")



\### A. Moteur de Report Mensuel (Rollover Engine)



Lorsqu'un utilisateur consulte ou initialise un mois `YYYY-MM` :



1\. \*\*Répétition des modèles (`recurring\_templates`)\*\* :

\* Toutes les entrées avec `carry\_over = 1` génèrent automatiquement une ligne dans `transactions` pour le mois `YYYY-MM` (si elle n'existe pas déjà).

\* \*\*Exception Dépenses Imprévues (`UNFORESEEN\_EXPENSE`)\*\* : Elles n'ont jamais de `template\_id` et `carry\_over` est forcé à `0`. Elles ne se répètent \*\*jamais\*\*.





2\. \*\*Report du solde ou des dépenses\*\* :

\* Option configurable dans l'interface : reporter ou non le solde net de fin de mois `M-1` sur la ligne `carried\_over\_from\_previous` du mois `M`.







\### B. Gestion de la Désactivation et du Flag "En Attente" (`PENDING`)



1\. \*\*Comportement d'une dépense désactivée\*\* :

\* Toute dépense (récurrente ou courante) possède un switch rapide \*\*"Actif / En attente (Suspendu)"\*\*.

\* Lorsqu'elle est désactivée, elle \*\*ne disparaît pas\*\* de l'écran : elle reste visible dans sa liste respective (ou dans un sous-groupe dédié en bas de tableau) avec un badge visuel orange/gris \*\*"En attente"\*\* (`status = 'PENDING'`).





2\. \*\*Option de non-répétition temporaire\*\* :

\* Lors de la mise en attente d'une dépense récurrente, l'utilisateur choisit entre :

\* \*Suspendre uniquement pour ce mois\* (`transactions.status = 'PENDING'`).

\* \*Suspendre et ne plus répéter sur les mois suivants jusqu'à réactivation\* (`recurring\_templates.status = 'PENDING\_PAUSED'` et `carry\_over = 0`).









3\. \*\*Réactivation en 1 clic\*\* :

\* À tout moment, un clic sur le bouton \*\*"Réactiver"\*\* repasse la dépense en `ACTIVE`, la réintègre immédiatement dans le mois en cours et réactive sa répétition future si souhaité.





4\. \*\*Règle d'exclusion stricte des calculs\*\* :

\* Toutes les requêtes SQL et fonctions TypeScript calculant le \*\*Total des dépenses\*\*, le \*\*Reste à vivre\*\*, le \*\*Taux d'épargne\*\* et les \*\*Statistiques\*\* doivent obligatoirement filtrer avec `WHERE status = 'ACTIVE'`.

\* Un compteur informatif séparé affiche toutefois : \*"Montant total en attente (non comptabilisé) : X €"\* pour garder une visibilité claire.







\---



\## 5. ARCHITECTURE DE L'INTERFACE (NAVIGATION LATÉRALE GAUCHE)



L'interface adopte un layout Desktop fixe : \*\*Sidebar gauche (260px)\*\* + \*\*Header de sélection du Mois/Année (`< Octobre 2026 >`) avec KPIs rapides\*\* + \*\*Zone de travail principale\*\*.



\### Onglet 1 : Tableau de Bord (Vue Synthétique)



\* \*\*Bandeau supérieur (4 cartes KPI)\*\* :

1\. \*\*Rentrées d'argent nettes\*\* (Mois en cours).

2\. \*\*Total Dépenses Actives\*\* (Fixes + Courantes + Imprévues).

3\. \*\*Reste à vivre réel\*\* (Rentrées - Dépenses Actives + Report M-1).

4\. \*\*Enveloppe "En attente"\*\* (Total des dépenses suspendues, hors calcul).





\* \*\*Jauge visuelle de santé budgétaire\*\* : Barre de progression répartissant % Charges fixes / % Dépenses courantes / % Imprévus / % Reste à vivre.



\### Onglet 2 : Rentrées d'argent (`INCOME`)



\* Gestion des flux entrants récurrents ou ponctuels.

\* Colonnes du tableau : `Date | Libellé | Catégorie | Sous-catégorie | Récurrence (Oui/Non) | Statut (Actif/En attente) | Montant | Actions`.



\### Onglet 3 : Dépenses qui se répètent (`RECURRING\_EXPENSE`)



\* Dédié aux charges fixes, abonnements et prélèvements automatiques.

\* Affichage du \*\*jour de prélèvement\*\* (ex: "Le 05 du mois").

\* Toggle rapide : \*\*Actif\*\* / \*\*En attente (Suspendu)\*\* + case à cocher \*\*"Reporter le mois prochain"\*\*.

\* Section visuelle distincte ou filtre rapide pour voir les abonnements mis en pause ("En attente") et les réactiver en un clic.



\### Onglet 4 : Dépenses courantes (`CURRENT\_EXPENSE`)



\* Dépenses du quotidien fluctuantes (courses, carburant, loisirs).

\* Possibilité de définir des dépenses courantes reportables (ex: budget enveloppe hebdomadaire ou dépense étalée) ou ponctuelles, avec le même mécanisme de mise en attente (`PENDING`).

\* Saisie ultra-rapide au clavier (raccourci `N` ou barre d'ajout rapide en haut de tableau).



\### Onglet 5 : Dépenses imprévues (`UNFORESEEN\_EXPENSE`)



\* Dépenses exceptionnelles et urgences.

\* \*\*Verrouillage métier\*\* : Aucune option de répétition mensuelle. Ces entrées appartiennent strictement au mois de leur saisie.

\* Mise en évidence de l'impact de ces imprévus sur le reste à vivre du mois.



\### Onglet 6 : Gestion (Catégories \& Paramètres)



\* \*\*CRUD complet des Catégories et Sous-catégories\*\* :

\* Création, modification du nom, choix de l'icône (`lucide-react` picker), choix de la couleur pastille, affectation au type d'onglet.

\* Désactivation ou fusion de catégories (si une catégorie est supprimée, proposer de réassigner ses transactions vers une autre catégorie pour ne jamais casser l'intégrité SQL).





\* \*\*Sauvegarde \& Audit\*\* : Bouton d'export/import de la base SQLite (`.db` ou `.json`) et bouton d'inspection de sécurité (Passkeys enregistrées).



\### Onglet 7 : Statistiques \& Analyses



\* \*\*Sélecteur de granularité\*\* : Par \*\*Jour\*\*, par \*\*Mois\*\*, par \*\*Année\*\*, ou plage personnalisée.

\* \*\*Visualisations attendues (`Recharts`)\*\* :

1\. \*\*BarChart comparatif\*\* : Entrées vs Sorties (empilées par type : Récurrentes / Courantes / Imprévues) par mois sur l'année.

2\. \*\*AreaChart (Courbe de trésorerie)\*\* : Évolution jour par jour du solde sur le mois sélectionné.

3\. \*\*Donut Chart interactif\*\* : Répartition des dépenses par catégorie et sous-catégorie (clic sur une catégorie pour zoomer sur ses sous-catégories).

4\. \*\*Top 5 des postes de dépenses\*\* et \*\*Évolution du poids des abonnements (charges fixes)\*\*.







\---



\## 6. RÉFÉRENTIEL EXHAUSTIF DES CATÉGORIES (SEED INITIAL)



L'agent doit créer un script `seed.ts` qui peuple automatiquement la base SQLite au premier lancement avec la taxonomie complète suivante :



| Type d'Onglet | Catégorie Principale | Icône Lucide | Couleur | Sous-catégories incluses par défaut |

| --- | --- | --- | --- | --- |

| \*\*1. Rentrées d'argent\*\* (`INCOME`) | \*\*Revenus du travail\*\* | `Briefcase` | `#10B981` | Salaire net, Primes \& 13ème mois, Heures supplémentaires, Revenus freelance / Indépendant |

|  | \*\*Aides \& Allocations\*\* | `HeartHandshake` | `#34D399` | CAF (APL, Prime d'activité, Allocations familiales), France Travail (Chômage), Bourses, Indemnités journalières (CPAM) |

|  | \*\*Revenus du capital \& Biens\*\* | `TrendingUp` | `#059669` | Loyers perçus, Dividendes, Intérêts livrets, Vente d'objets (Seconde main) |

|  | \*\*Rentrées exceptionnelles\*\* | `Gift` | `#6EE7B7` | Remboursement mutuelle/sécu, Remboursement impôts, Cadeaux / Dons reçus, Gains divers |

| \*\*2. Dépenses répétitives\*\* (`RECURRING\_EXPENSE`) | \*\*Logement \& Énergie\*\* | `Home` | `#3B82F6` | Loyer / Mensualité crédit immo, Charges de copropriété, Électricité, Gaz, Eau, Taxe foncière mensualisée |

|  | \*\*Télécoms \& Médias\*\* | `Wifi` | `#6366F1` | Box Internet / Fibre, Forfaits mobiles, Streaming vidéo (Netflix, Disney+, etc.), Musique (Spotify, Deezer), Cloud \& IA, Jeux vidéo ( Abonnements) |

|  | \*\*Assurances \& Banque\*\* | `ShieldCheck` | `#8B5CF6` | Assurance Habitation, Assurance Auto/Moto, Mutuelle santé, Prévoyance / Assurance vie, Frais de tenue de compte / Carte bancaire |

|  | \*\*Crédits \& Dettes\*\* | `Landmark` | `#EC4899` | Crédit auto, Crédit consommation, Prêt étudiant, Paiements en plusieurs fois (3x/4x) |

|  | \*\*Abonnements \& Services\*\* | `CalendarSync` | `#14B8A6` | Salle de sport / Club, Transports (Navigo, abonnement train), Garde d'enfants / Crèche, Cantine scolaire |

| \*\*3. Dépenses courantes\*\* (`CURRENT\_EXPENSE`) | \*\*Alimentation \& Maison\*\* | `ShoppingCart` | `#F59E0B` | Supermarché / Courses, Boulangerie, Marché / Producteurs locaux, Produits d'entretien \& Hygiène |

|  | \*\*Transports \& Véhicule\*\* | `Fuel` | `#F97316` | Carburant / Recharge électrique, Péages, Parking, Billets de train / bus ponctuels, Lavage auto |

|  | \*\*Animaux de compagnie\*\* | `PawPrint` | `#A855F7` | Alimentation (Croquettes, pâtées), Friandises \& Jouets, Toilettage \& Antiparasitaires, Accessoires |

|  | \*\*Vie quotidienne \& Famille\*\* | `Baby` | `#06B6D4` | Habillement \& Chaussures, Coiffeur \& Esthétique, Pharmacie courante, Fournitures scolaires \& Activités enfants |

|  | \*\*Loisirs \& Sorties\*\* | `Utensils` | `#EF4444` | Restaurants \& Fast-food, Bars \& Cafés, Cinéma / Spectacles, Jeux \& Loisirs, Tabac / Presse / Jeux de grattage |

|  | \*\*Épargne mensuelle\*\* | `PiggyBank` | `#84CC16` | Virement Livret A / LDDS, PEA / Compte-titres, Épargne projet / Vacances |

| \*\*4. Dépenses imprévues\*\* (`UNFORESEEN\_EXPENSE`) | \*\*Pannes \& Réparations Auto\*\* | `Wrench` | `#DC2626` | Réparation mécanique, Pneus / Freins / Batterie, Franchise sinistre, Contrôle technique \& Contre-visite |

|  | \*\*Urgences Domicile\*\* | `Hammer` | `#EA580C` | Plomberie / Chauffage / Serrurerie, Remplacement électroménager (Panne), Bricolage d'urgence |

|  | \*\*Santé \& Vétérinaire\*\* | `Stethoscope` | `#E11D48` | Urgences vétérinaires / Chirurgie animale, Soins dentaires / Optique non remboursés, Médicaments non remboursés |

|  | \*\*Amendes \& Régularisations\*\* | `AlertTriangle` | `#991B1B` | Contraventions / Radars, Régularisation annuelle Énergie/Eau, Rattrapage d'impôts, Frais de découvert |

|  | \*\*Coups durs \& Divers\*\* | `HelpCircle` | `#64748B` | Remplacement PC / Smartphone cassé, Déplacement familial imprévu, Cadeau de dernière minute |



\---



\## 7. PLAN D'EXÉCUTION SÉQUENTIEL POUR L'AGENT IA



L'agent doit exécuter le développement dans cet ordre précis et mettre à jour `knowledge.md` à la fin de chaque étape :



1\. \*\*Étape 1 : Initialisation \& `knowledge.md\*\*`

\* Création de l'architecture Monorepo (`/server` et `/client` ou structure unifiée Vite + Express).

\* Création immédiate du fichier `knowledge.md` avec la structure documentaire.





2\. \*\*Étape 2 : Base de données SQLite \& Seed\*\*

\* Implémentation du schéma SQLite (`db.ts`) et du script `seed.ts` contenant toutes les catégories et sous-catégories ci-dessus.





3\. \*\*Étape 3 : Sécurité (Passkey WebAuthn + JWT 32+ chars)\*\*

\* Mise en place du validateur d'environnement (`JWT\_SECRET.length >= 32`), des routes d'enregistrement/connexion Passkey et du middleware de protection des routes API.





4\. \*\*Étape 4 : API REST \& Moteur de Report (`Rollover Engine`)\*\*

\* Création des endpoints CRUD pour les transactions, les modèles récurrents, les catégories et le calcul des statistiques.

\* Implémentation de la fonction d'initialisation de mois qui clone les modèles actifs et gère les statuts `ACTIVE` vs `PENDING`.





5\. \*\*Étape 5 : Frontend - Layout, Sidebar \& Gestion des États\*\*

\* Création de la Sidebar à 7 onglets, du sélecteur de mois global et des composants de tableaux avec filtres, badges "En attente" et switch d'activation/désactivation instantané.





6\. \*\*Étape 6 : Frontend - Onglets Gestion \& Statistiques\*\*

\* Interface CRUD des catégories avec sélecteur d'icônes/couleurs et intégration des graphiques `Recharts` (Jour / Mois / Année).





7\. \*\*Étape 7 : Audit final \& Synchronisation `knowledge.md\*\*`

\* Vérification de tous les types TypeScript, test des calculs d'exclusion des dépenses `PENDING`, et validation finale de l'exhaustivité de `knowledge.md`.







\---

