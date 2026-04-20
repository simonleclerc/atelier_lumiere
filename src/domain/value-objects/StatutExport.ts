/**
 * Value Object — statut d'export d'une Commande, ou statut agrégé d'une
 * Session.
 *
 * Quatre natures possibles (union fermée) :
 *  - `pas-exporte` : statut initial. La commande n'a jamais été exportée
 *    (ou est vide). Aucun fichier écrit sur le disque pour elle.
 *  - `incomplet` : la commande a été exportée une fois, mais un tirage a
 *    été ajouté/retiré depuis. Les fichiers physiques ne reflètent plus
 *    le contenu actuel.
 *  - `erreur` : le dernier export a échoué (photo manquante, droits FS,
 *    etc.). Le message explicatif est conservé dans `messageErreur`.
 *  - `complet` : le dernier export a réussi, et rien n'a bougé depuis.
 *
 * Immutable. Transitions pilotées par l'agrégat Commande (méthodes
 * `enregistrerExportReussi`, `enregistrerExportEchec` + transitions
 * automatiques au sein de `ajouterTirage` / `retirerTirage`).
 *
 * L'agrégation pour la session est une fonction statique pure — la Session
 * n'a pas accès à ses commandes (cycle de vie séparé), donc le calcul vit
 * dans le VO.
 */
export type NatureStatutExport =
  | "pas-exporte"
  | "incomplet"
  | "erreur"
  | "complet";

export class StatutExport {
  private constructor(
    readonly nature: NatureStatutExport,
    readonly messageErreur?: string,
  ) {}

  static pasExporte(): StatutExport {
    return new StatutExport("pas-exporte");
  }

  static incomplet(): StatutExport {
    return new StatutExport("incomplet");
  }

  static complet(): StatutExport {
    return new StatutExport("complet");
  }

  static enErreur(message: string): StatutExport {
    const propre = message.trim();
    return new StatutExport("erreur", propre || "Erreur inconnue");
  }

  estPasExporte(): boolean {
    return this.nature === "pas-exporte";
  }

  estIncomplet(): boolean {
    return this.nature === "incomplet";
  }

  estEnErreur(): boolean {
    return this.nature === "erreur";
  }

  estComplet(): boolean {
    return this.nature === "complet";
  }

  /**
   * Agrège les statuts de toutes les commandes d'une session pour produire
   * le statut de la session. Règles (dans l'ordre, dès qu'une match on s'arrête) :
   *  1. Au moins une commande en erreur  → erreur (sans message agrégé — détail visible par commande)
   *  2. Tout complet                     → complet
   *  3. Tout pas-exporte                 → pas-exporte
   *  4. Autrement (mix)                  → incomplet
   *
   * Cas limite : aucune commande du tout → pas-exporte (rien à exporter).
   */
  static agreger(statuts: readonly StatutExport[]): StatutExport {
    if (statuts.length === 0) return StatutExport.pasExporte();
    if (statuts.some((s) => s.estEnErreur())) {
      return new StatutExport("erreur");
    }
    if (statuts.every((s) => s.estComplet())) return StatutExport.complet();
    if (statuts.every((s) => s.estPasExporte())) {
      return StatutExport.pasExporte();
    }
    return StatutExport.incomplet();
  }
}
