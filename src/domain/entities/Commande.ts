import { Montant } from "../value-objects/Montant";
import { LigneCommande } from "./LigneCommande";

/**
 * Agrégat racine séparé de Session.
 *
 * Pourquoi pas une entité fille de Session ? Parce que les cycles de vie
 * divergent : la Session est créée au shoot, figée peu après. Les commandes
 * arrivent dans les semaines/mois qui suivent, sur une même session.
 * Règle Vernon : les frontières d'agrégat reflètent les cycles de vie.
 *
 * Références INTER-AGRÉGATS par ID uniquement (sessionId, acheteurId) —
 * jamais d'objet Session ni Acheteur embarqué. Règle Vernon « Reference
 * Other Aggregates By Identity ».
 *
 * Invariants protégés ICI :
 *  - sessionId et acheteurId non vides (l'existence même de ces objets est
 *    un invariant INTER-agrégats vérifié par le use case, pas ici)
 *  - chaque ligne valide (délégué à LigneCommande)
 *
 * Pas d'invariant "min 1 ligne" : une commande peut exister vide le temps
 * qu'on saisit ses lignes. Décision pragmatique UX.
 */
export interface CommandeDonnees {
  readonly id: string;
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly dateCreation: Date;
  readonly lignes?: readonly LigneCommande[];
}

export class LigneCommandeIntrouvable extends Error {
  constructor(ligneId: string) {
    super(`Ligne de commande introuvable pour l'id "${ligneId}".`);
    this.name = "LigneCommandeIntrouvable";
  }
}

export class Commande {
  readonly id: string;
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly dateCreation: Date;

  private readonly _lignes: LigneCommande[];

  constructor(donnees: CommandeDonnees) {
    if (!donnees.id.trim()) {
      throw new Error("Commande: id vide refusé.");
    }
    if (!donnees.sessionId.trim()) {
      throw new Error("Commande: sessionId vide refusé.");
    }
    if (!donnees.acheteurId.trim()) {
      throw new Error("Commande: acheteurId vide refusé.");
    }
    if (Number.isNaN(donnees.dateCreation.getTime())) {
      throw new Error("Commande: dateCreation invalide.");
    }

    this.id = donnees.id;
    this.sessionId = donnees.sessionId;
    this.acheteurId = donnees.acheteurId;
    this.dateCreation = donnees.dateCreation;
    this._lignes = [...(donnees.lignes ?? [])];
  }

  static creer(params: {
    sessionId: string;
    acheteurId: string;
    id?: string;
    dateCreation?: Date;
  }): Commande {
    return new Commande({
      id: params.id ?? crypto.randomUUID(),
      sessionId: params.sessionId,
      acheteurId: params.acheteurId,
      dateCreation: params.dateCreation ?? new Date(),
      lignes: [],
    });
  }

  get lignes(): readonly LigneCommande[] {
    return this._lignes;
  }

  ajouterLigne(ligne: LigneCommande): void {
    this._lignes.push(ligne);
  }

  retirerLigne(ligneId: string): void {
    const index = this._lignes.findIndex((l) => l.id === ligneId);
    if (index === -1) throw new LigneCommandeIntrouvable(ligneId);
    this._lignes.splice(index, 1);
  }

  total(): Montant {
    return this._lignes.reduce(
      (somme, ligne) => somme.ajouter(ligne.total()),
      new Montant(0),
    );
  }

  nombreTirages(): number {
    return this._lignes.reduce((n, l) => n + l.quantite, 0);
  }
}
