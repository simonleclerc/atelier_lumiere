/**
 * Port UI — ouvre un dialog natif pour que l'utilisateur choisisse un dossier.
 *
 * Pourquoi un port côté UI plutôt que d'importer `@tauri-apps/plugin-dialog`
 * dans le composant React ? Parce que le CLAUDE.md pose une règle stricte :
 * « la composition root est le SEUL endroit qui connaît les implémentations
 * concrètes ». Même l'UI traite Tauri comme une dépendance injectable.
 *
 * Bénéfice immédiat : on peut rendre ce composant en Storybook / tests
 * unitaires sans Tauri, en injectant un mock qui retourne un chemin en dur.
 */
export interface DossierPicker {
  choisir(titre: string): Promise<string | null>;
}
