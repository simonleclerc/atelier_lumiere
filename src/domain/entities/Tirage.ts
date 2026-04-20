import { Format } from "../value-objects/Format";
import type { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";

/**
 * Entité fille de l'agrégat Commande.
 *
 * Vocabulaire : on parle de **Tirage** (terme métier de l'impression photo),
 * pas de "ligne de commande" — le mot "ligne" est réservé à l'UI pour
 * désigner une rangée d'affichage.
 *
 * Un Tirage c'est une photo donnée, dans un format donné, en une quantité
 * donnée. **Pas de prix capturé sur le tirage** : tant qu'on n'a pas de
 * factures, on veut que modifier la grille d'une session se reflète
 * immédiatement sur toutes les commandes (pas de snapshot figé). Le prix
 * se calcule à la volée depuis la grille de la Session, d'où la signature
 * `total(grille)`.
 *
 * Quand on introduira la facturation (slice future), on capturera le
 * snapshot au moment de la facturation sur l'entité `Facture`, pas ici.
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
}

export class Tirage {
  readonly id: string;
  readonly photoNumero: number;
  readonly format: Format;
  readonly quantite: number;

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
  }

  static creer(params: {
    photoNumero: number;
    format: Format;
    quantite: number;
    id?: string;
  }): Tirage {
    return new Tirage({
      id: params.id ?? crypto.randomUUID(),
      photoNumero: params.photoNumero,
      format: params.format,
      quantite: params.quantite,
    });
  }

  /**
   * Prix unitaire lu dans la grille passée en paramètre. Méthode pure :
   * aucun prix n'est stocké sur le Tirage, on lit à la demande.
   */
  montantUnitaire(grille: GrilleTarifaire): Montant {
    return grille.prixPour(this.format);
  }

  total(grille: GrilleTarifaire): Montant {
    return this.montantUnitaire(grille).multiplierPar(this.quantite);
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
    });
  }
}