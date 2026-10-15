import { db } from './index.js';
import crypto from 'crypto';

interface SeedCategory {
  id: string;
  name: string;
  type: 'INCOME' | 'RECURRING_EXPENSE' | 'CURRENT_EXPENSE' | 'UNFORESEEN_EXPENSE';
  icon: string;
  color: string;
  subcategories: string[];
}

export const SEED_CATEGORIES: SeedCategory[] = [
  // 1. Rentrées d'argent (INCOME)
  {
    id: 'cat-inc-work',
    name: 'Revenus du travail',
    type: 'INCOME',
    icon: 'Briefcase',
    color: '#10B981',
    subcategories: [
      'Salaire net',
      'Primes & 13ème mois',
      'Heures supplémentaires',
      'Revenus freelance / Indépendant',
    ],
  },
  {
    id: 'cat-inc-benefits',
    name: 'Aides & Allocations',
    type: 'INCOME',
    icon: 'HeartHandshake',
    color: '#34D399',
    subcategories: [
      'CAF (APL, Prime d\'activité, Allocations familiales)',
      'France Travail (Chômage)',
      'Bourses',
      'Indemnités journalières (CPAM)',
    ],
  },
  {
    id: 'cat-inc-capital',
    name: 'Revenus du capital & Biens',
    type: 'INCOME',
    icon: 'TrendingUp',
    color: '#059669',
    subcategories: [
      'Loyers perçus',
      'Dividendes',
      'Intérêts livrets',
      'Vente d\'objets (Seconde main)',
    ],
  },
  {
    id: 'cat-inc-exceptional',
    name: 'Rentrées exceptionnelles',
    type: 'INCOME',
    icon: 'Gift',
    color: '#6EE7B7',
    subcategories: [
      'Remboursement mutuelle/sécu',
      'Remboursement impôts',
      'Cadeaux / Dons reçus',
      'Gains divers',
    ],
  },

  // 2. Dépenses répétitives (RECURRING_EXPENSE)
  {
    id: 'cat-rec-housing',
    name: 'Logement & Énergie',
    type: 'RECURRING_EXPENSE',
    icon: 'Home',
    color: '#3B82F6',
    subcategories: [
      'Loyer / Mensualité crédit immo',
      'Charges de copropriété',
      'Électricité',
      'Gaz',
      'Eau',
      'Taxe foncière mensualisée',
    ],
  },
  {
    id: 'cat-rec-telecom',
    name: 'Télécoms & Médias',
    type: 'RECURRING_EXPENSE',
    icon: 'Wifi',
    color: '#6366F1',
    subcategories: [
      'Box Internet / Fibre',
      'Forfaits mobiles',
      'Streaming vidéo (Netflix, Disney+, etc.)',
      'Musique (Spotify, Deezer)',
      'Cloud & IA',
      'Jeux vidéo ( Abonnements)',
    ],
  },
  {
    id: 'cat-rec-insurance',
    name: 'Assurances & Banque',
    type: 'RECURRING_EXPENSE',
    icon: 'ShieldCheck',
    color: '#8B5CF6',
    subcategories: [
      'Assurance Habitation',
      'Assurance Auto/Moto',
      'Mutuelle santé',
      'Prévoyance / Assurance vie',
      'Frais de tenue de compte / Carte bancaire',
    ],
  },
  {
    id: 'cat-rec-loans',
    name: 'Crédits & Dettes',
    type: 'RECURRING_EXPENSE',
    icon: 'Landmark',
    color: '#EC4899',
    subcategories: [
      'Crédit auto',
      'Crédit consommation',
      'Prêt étudiant',
      'Paiements en plusieurs fois (3x/4x)',
    ],
  },
  {
    id: 'cat-rec-subscriptions',
    name: 'Abonnements & Services',
    type: 'RECURRING_EXPENSE',
    icon: 'CalendarSync',
    color: '#14B8A6',
    subcategories: [
      'Salle de sport / Club',
      'Transports (Navigo, abonnement train)',
      'Garde d\'enfants / Crèche',
      'Cantine scolaire',
    ],
  },

  // 3. Dépenses courantes (CURRENT_EXPENSE)
  {
    id: 'cat-cur-food',
    name: 'Alimentation & Maison',
    type: 'CURRENT_EXPENSE',
    icon: 'ShoppingCart',
    color: '#F59E0B',
    subcategories: [
      'Supermarché / Courses',
      'Boulangerie',
      'Marché / Producteurs locaux',
      'Produits d\'entretien & Hygiène',
    ],
  },
  {
    id: 'cat-cur-transport',
    name: 'Transports & Véhicule',
    type: 'CURRENT_EXPENSE',
    icon: 'Fuel',
    color: '#F97316',
    subcategories: [
      'Carburant / Recharge électrique',
      'Péages',
      'Parking',
      'Billets de train / bus ponctuels',
      'Lavage auto',
    ],
  },
  {
    id: 'cat-cur-pets',
    name: 'Animaux de compagnie',
    type: 'CURRENT_EXPENSE',
    icon: 'PawPrint',
    color: '#A855F7',
    subcategories: [
      'Alimentation (Croquettes, pâtées)',
      'Friandises & Jouets',
      'Toilettage & Antiparasitaires',
      'Accessoires',
    ],
  },
  {
    id: 'cat-cur-family',
    name: 'Vie quotidienne & Famille',
    type: 'CURRENT_EXPENSE',
    icon: 'Baby',
    color: '#06B6D4',
    subcategories: [
      'Habillement & Chaussures',
      'Coiffeur & Esthétique',
      'Pharmacie courante',
      'Fournitures scolaires & Activités enfants',
    ],
  },
  {
    id: 'cat-cur-leisure',
    name: 'Loisirs & Sorties',
    type: 'CURRENT_EXPENSE',
    icon: 'Utensils',
    color: '#EF4444',
    subcategories: [
      'Restaurants & Fast-food',
      'Bars & Cafés',
      'Cinéma / Spectacles',
      'Jeux & Loisirs',
      'Tabac / Presse / Jeux de grattage',
    ],
  },
  {
    id: 'cat-cur-savings',
    name: 'Épargne mensuelle',
    type: 'CURRENT_EXPENSE',
    icon: 'PiggyBank',
    color: '#84CC16',
    subcategories: [
      'Virement Livret A / LDDS',
      'PEA / Compte-titres',
      'Épargne projet / Vacances',
    ],
  },

  // 4. Dépenses imprévues (UNFORESEEN_EXPENSE)
  {
    id: 'cat-unf-car',
    name: 'Pannes & Réparations Auto',
    type: 'UNFORESEEN_EXPENSE',
    icon: 'Wrench',
    color: '#DC2626',
    subcategories: [
      'Réparation mécanique',
      'Pneus / Freins / Batterie',
      'Franchise sinistre',
      'Contrôle technique & Contre-visite',
    ],
  },
  {
    id: 'cat-unf-home',
    name: 'Urgences Domicile',
    type: 'UNFORESEEN_EXPENSE',
    icon: 'Hammer',
    color: '#EA580C',
    subcategories: [
      'Plomberie / Chauffage / Serrurerie',
      'Remplacement électroménager (Panne)',
      'Bricolage d\'urgence',
    ],
  },
  {
    id: 'cat-unf-health',
    name: 'Santé & Vétérinaire',
    type: 'UNFORESEEN_EXPENSE',
    icon: 'Stethoscope',
    color: '#E11D48',
    subcategories: [
      'Urgences vétérinaires / Chirurgie animale',
      'Soins dentaires / Optique non remboursés',
      'Médicaments non remboursés',
    ],
  },
  {
    id: 'cat-unf-fines',
    name: 'Amendes & Régularisations',
    type: 'UNFORESEEN_EXPENSE',
    icon: 'AlertTriangle',
    color: '#991B1B',
    subcategories: [
      'Contraventions / Radars',
      'Régularisation annuelle Énergie/Eau',
      'Rattrapage d\'impôts',
      'Frais de découvert',
    ],
  },
  {
    id: 'cat-unf-misc',
    name: 'Coups durs & Divers',
    type: 'UNFORESEEN_EXPENSE',
    icon: 'HelpCircle',
    color: '#64748B',
    subcategories: [
      'Remplacement PC / Smartphone cassé',
      'Déplacement familial imprévu',
      'Cadeau de dernière minute',
    ],
  },
];

export function seedCategories(): { categoriesInserted: number; subcategoriesInserted: number } {
  const insertCategory = db.prepare(`
    INSERT OR REPLACE INTO categories (id, name, type, icon, color, is_system, is_active)
    VALUES (?, ?, ?, ?, ?, 1, 1)
  `);

  const insertSubcategory = db.prepare(`
    INSERT OR REPLACE INTO subcategories (id, category_id, name)
    VALUES (?, ?, ?)
  `);

  let categoriesCount = 0;
  let subcategoriesCount = 0;

  const runSeed = db.transaction(() => {
    for (const cat of SEED_CATEGORIES) {
      insertCategory.run(cat.id, cat.name, cat.type, cat.icon, cat.color);
      categoriesCount++;

      for (const subName of cat.subcategories) {
        // ID déterministe pour éviter les doublons lors des re-seeds
        const subId = 'sub-' + crypto.createHash('md5').update(`${cat.id}:${subName}`).digest('hex').substring(0, 12);
        insertSubcategory.run(subId, cat.id, subName);
        subcategoriesCount++;
      }
    }
  });

  runSeed();

  return {
    categoriesInserted: categoriesCount,
    subcategoriesInserted: subcategoriesCount,
  };
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  console.log('🌱 Amorçage des catégories et sous-catégories...');
  const result = seedCategories();
  console.log(`✅ Succès : ${result.categoriesInserted} catégories et ${result.subcategoriesInserted} sous-catégories insérées.`);
}
