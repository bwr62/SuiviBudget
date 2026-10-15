/**
 * Helper sécurisé pour construire dynamiquement des requêtes UPDATE avec Prepared Statements SQLite.
 */
export function buildDynamicUpdate(
  table: string,
  idColumn: string,
  idValue: string | number,
  fields: Record<string, any>
): { sql: string; values: any[] } {
  const keys = Object.keys(fields).filter((k) => fields[k] !== undefined);
  if (keys.length === 0) {
    throw new Error('Aucun champ fourni pour la mise à jour.');
  }

  // Vérification de sécurité basique sur les noms de colonnes (anti-injection)
  for (const k of keys) {
    if (!/^[a-zA-Z0-9_]+$/.test(k)) {
      throw new Error(`Nom de colonne invalide : ${k}`);
    }
  }

  const setClauses = keys.map((k) => `${k} = ?`).join(', ');
  const sql = `UPDATE ${table} SET ${setClauses} WHERE ${idColumn} = ?`;
  const values = [...keys.map((k) => fields[k]), idValue];

  return { sql, values };
}

/**
 * Arrondit un montant financier à 2 décimales pour éviter les imprécisions IEEE 754 (E5)
 */
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}
