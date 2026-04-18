import { Format } from "../value-objects/Format";
import { Montant } from "../value-objects/Montant";

/**
 * Entité fille de l'agrégat Commande.
 *
 * Pourquoi entité et pas VO ? Parce qu'on veut pouvoir référencer, éditer
 * ou retirer une ligne précise par son id, même si deux lignes ont le même
 * contenu métier. Deux `{ photo 145, 20x30, qté 1 }` peuvent coexister et
 * être distinctes : l'utilisateur a cliqué deux fois "Ajouter" et il a le
 * droit d'en retirer une seule.
 *
 * Pattern SNAPSHOT : `montantUnitaire` est FIGÉ à la création, capturé
 * depuis la grille tarifaire de la session au moment où la ligne est
 * créée. Conséquence : si le copain ajuste un prix de la session plus
 * tard, les commandes déjà passées gardent leurs prix d'origine.
 * Anti-pattern évité : référencer la grille live (ou la session) depuis
 * la ligne — toute réécriture globale repeindrait les factures passées.
 */
export interface LigneCommandeDonnees {
  readonly id: string;
  readonly photoNumero: number;
  readonly format: Format;
  readonly quantite: number;
  readonly montantUnitaire: Montant;
}

export class LigneCommande {
  readonly id: string;
  readonly photoNumero: number;
  readonly format: Format;
  readonly quantite: number;
  readonly montantUnitaire: Montant;

  constructor(donnees: LigneCommandeDonnees) {
    if (!donnees.id.trim()) {
      throw new Error("LigneCommande: id vide refusé.");
    }
    if (!Number.isInteger(donnees.photoNumero) || donnees.photoNumero < 1) {
      throw new Error(
        `LigneCommande: photoNumero entier ≥ 1 attendu (reçu ${donnees.photoNumero}).`,
      );
    }
    if (!Number.isInteger(donnees.quantite) || donnees.quantite < 1) {
      throw new Error(
        `LigneCommande: quantite entière ≥ 1 attendue (reçu ${donnees.quantite}).`,
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
  }): LigneCommande {
    return new LigneCommande({
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
}
