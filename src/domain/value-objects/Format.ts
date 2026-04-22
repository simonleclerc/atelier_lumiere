/**
 * Value Object (DDD) — identité par valeur, immuable, pas de cycle de vie propre.
 *
 * Catalogue FERMÉ des formats d'impression proposés par le copain. Deux Format de
 * même valeur sont interchangeables — c'est exactement la définition d'un VO
 * (Evans, Domain-Driven Design, chap. Value Object).
 *
 * Pattern "instances statiques" : on expose les valeurs autorisées comme des
 * constantes de classe pour empêcher qu'un appelant construise un format bidon.
 * Le constructeur est privé ; on passe par `Format.depuis(string)` pour parser
 * une valeur externe (persistance, saisie utilisateur).
 */
export class Format {
  static readonly _15x23 = new Format("15x23");
  static readonly _20x30 = new Format("20x30");
  static readonly _30x45 = new Format("30x45");
  static readonly NUMERIQUE = new Format("Numerique");

  static readonly TOUS: readonly Format[] = [
    Format._15x23,
    Format._20x30,
    Format._30x45,
    Format.NUMERIQUE,
  ];

  private constructor(readonly valeur: string) {}

  static depuis(valeur: string): Format {
    const trouve = Format.TOUS.find((f) => f.valeur === valeur);
    if (!trouve) {
      const autorises = Format.TOUS.map((f) => f.valeur).join(", ");
      throw new Error(
        `Format inconnu: "${valeur}". Valeurs autorisées : ${autorises}.`,
      );
    }
    return trouve;
  }

  egale(autre: Format): boolean {
    return this.valeur === autre.valeur;
  }

  /**
   * True si ce format est la livraison numérique (fichier digital, pas un
   * tirage papier). Sert aux invariants métier qui dépendent du média :
   * par exemple "un fichier digital ne se commande qu'en 1 exemplaire".
   */
  estNumerique(): boolean {
    return this.egale(Format.NUMERIQUE);
  }

  /** Nom du sous-dossier créé à l'export (ex : "20x30", "Numerique"). */
  toDossierName(): string {
    return this.valeur;
  }
}
