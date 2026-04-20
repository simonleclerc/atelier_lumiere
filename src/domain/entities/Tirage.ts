import { Format } from "../value-objects/Format";
import { Montant } from "../value-objects/Montant";

/**
 * Entité fille de l'agrégat Commande.
 *
 * Vocabulaire : on parle de **Tirage** (terme métier de l'impression photo),
 * pas de "ligne de commande" — le mot "ligne" est réservé à l'UI pour
 * désigner une rangée d'affichage.
 *
 * Un Tirage c'est une photo donnée, dans un format donné, en une quantité
 * donnée, avec un prix unitaire FIGÉ au moment de la création (pattern
 * snapshot). Si le copain ajuste la grille tarifaire plus tard, ce tirage
 * garde son prix d'origine.
 *
 * Pourquoi entité et pas VO ? Parce qu'on veut pouvoir référencer, consolider
 * ou retirer un tirage précis par son id. Deux tirages peuvent exister dans
 * la commande avec des contenus différents — chacun a son identité propre.
 *
 * Contrainte d'unicité au niveau de la COMMANDE (pas de l'entité) :
 * `(photoNumero, format)` est unique dans une commande. Invariant porté
 * par `Commande.ajouterTirage` qui consolide si le couple existe déjà.
 */
export interface TirageDonnees {
  readonly id: string;
  readonly photoNumero: number;
  readonly format: Format;
  readonly quantite: number;
  readonly montantUnitaire: Montant;
}

export class Tirage {
  readonly id: string;
  readonly photoNumero: number;
  readonly format: Format;
  readonly quantite: number;
  readonly montantUnitaire: Montant;

  constructor(donnees: TirageDonnees) {
    if (!donnees.id.trim()) {
      throw new Error("Tirage: id vide refusé.");
    }
    if (!Number.isInteger(donnees.photoNumero) || donnees.photoNumero < 1) {
      throw new Error(
        `Tirage: photoNumero entier ≥ 1 attendu (reçu ${donnees.photoNumero}).`,
      );
    }
    if (!Number.isInteger(donnees.quantite) || donnees.quantite < 1) {
      throw new Error(
        `Tirage: quantite entière ≥ 1 attendue (reçu ${donnees.quantite}).`,
      );
    }

    this.id = donnees.id;
    this.photoNumero = donnees.photoNumero;
    this.format = donnees.format;
    this.quantite = donnees.quantite;
    this.montantUnitaire = donnees.montantUnitaire;
  }

  static creer(params: {
    photoNumero: number;
    format: Format;
    quantite: number;
    montantUnitaire: Montant;
    id?: string;
  }): Tirage {
    return new Tirage({
      id: params.id ?? crypto.randomUUID(),
      photoNumero: params.photoNumero,
      format: params.format,
      quantite: params.quantite,
      montantUnitaire: params.montantUnitaire,
    });
  }

  total(): Montant {
    return this.montantUnitaire.multiplierPar(this.quantite);
  }

  /** True si ce Tirage a le même (photoNumero, format) — sert à la consolidation. */
  egaleContenu(photoNumero: number, format: Format): boolean {
    return this.photoNumero === photoNumero && this.format.egale(format);
  }

  avecQuantiteCumulee(quantiteAjoutee: number): Tirage {
    return new Tirage({
      id: this.id,
      photoNumero: this.photoNumero,
      format: this.format,
      quantite: this.quantite + quantiteAjoutee,
      montantUnitaire: this.montantUnitaire,
    });
  }
}
