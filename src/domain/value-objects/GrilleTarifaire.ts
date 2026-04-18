import { Format } from "./Format";
import { Montant } from "./Montant";

/**
 * Value Object — mapping Format → Montant pour une session.
 *
 * Deux invariants : (1) TOUS les formats du catalogue sont couverts — on ne
 * veut pas découvrir à l'export qu'un prix manque ; (2) immuabilité — une
 * fois copiée dans une Session, la grille ne bouge plus, ce qui garantit
 * qu'une commande passée reflète les prix du jour où elle a été créée.
 *
 * Cf. Vernon, Implementing DDD, chap. Value Objects : "Copy rather than
 * share". La grille par défaut globale est lue au moment où on crée la
 * Session, puis copiée — pas référencée.
 */
export class GrilleTarifaire {
  private readonly prix: ReadonlyMap<string, Montant>;

  constructor(entrees: ReadonlyArray<readonly [Format, Montant]>) {
    const clesPresentes = new Set(entrees.map(([f]) => f.toDossierName()));
    const manquants = Format.TOUS.filter(
      (f) => !clesPresentes.has(f.toDossierName()),
    );
    if (manquants.length > 0) {
      const liste = manquants.map((f) => f.toDossierName()).join(", ");
      throw new Error(`GrilleTarifaire: formats manquants (${liste}).`);
    }
    this.prix = new Map(entrees.map(([f, m]) => [f.toDossierName(), m]));
  }

  prixPour(format: Format): Montant {
    const montant = this.prix.get(format.toDossierName());
    if (!montant) {
      throw new Error(
        `GrilleTarifaire: format "${format.toDossierName()}" absent (invariant violé).`,
      );
    }
    return montant;
  }

  toEntrees(): ReadonlyArray<readonly [Format, Montant]> {
    return Format.TOUS.map((f) => [f, this.prixPour(f)] as const);
  }

  /**
   * "Évolution immutable" : ne mute pas `this`, retourne un nouveau VO avec
   * le prix modifié. Règle d'or des Value Objects — un VO n'évolue jamais,
   * on en construit un nouveau. La Session, elle (entité), peut échanger
   * sa grille entière contre la nouvelle.
   */
  avecPrixModifie(format: Format, montant: Montant): GrilleTarifaire {
    return new GrilleTarifaire(
      this.toEntrees().map(([f, m]) => [f, f.egale(format) ? montant : m]),
    );
  }
}
