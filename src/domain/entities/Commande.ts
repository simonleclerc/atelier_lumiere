import { Format } from "../value-objects/Format";
import { Montant } from "../value-objects/Montant";

/**
 * Agrégat racine séparé de Session.
 *
 * Modèle simplifié : une Commande = le contenu d'UN tirage (ou d'un lot
 * de tirages identiques). Un acheteur qui veut 3 photos différentes
 * = 3 Commandes distinctes. Simple, granulaire, zéro collection fille.
 *
 * Références INTER-AGRÉGATS par ID uniquement (sessionId, acheteurId) —
 * jamais d'objet Session ni Acheteur embarqué. Règle Vernon « Reference
 * Other Aggregates By Identity ».
 *
 * Invariants protégés ICI :
 *  - sessionId et acheteurId non vides (l'existence même de ces objets est
 *    un invariant INTER-agrégats vérifié par le use case, pas ici)
 *  - photoNumero entier ≥ 1
 *  - quantite entière ≥ 1
 *
 * Pattern SNAPSHOT : `montantUnitaire` est FIGÉ à la création, capturé
 * depuis la grille tarifaire de la session au moment où la commande est
 * créée. Conséquence : si le copain ajuste un prix plus tard, les
 * commandes déjà passées gardent leurs prix d'origine.
 */
export interface CommandeDonnees {
  readonly id: string;
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly dateCreation: Date;
  readonly photoNumero: number;
  readonly format: Format;
  readonly quantite: number;
  readonly montantUnitaire: Montant;
}

export class Commande {
  readonly id: string;
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly dateCreation: Date;
  readonly photoNumero: number;
  readonly format: Format;
  readonly quantite: number;
  readonly montantUnitaire: Montant;

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
    if (!Number.isInteger(donnees.photoNumero) || donnees.photoNumero < 1) {
      throw new Error(
        `Commande: photoNumero entier ≥ 1 attendu (reçu ${donnees.photoNumero}).`,
      );
    }
    if (!Number.isInteger(donnees.quantite) || donnees.quantite < 1) {
      throw new Error(
        `Commande: quantite entière ≥ 1 attendue (reçu ${donnees.quantite}).`,
      );
    }

    this.id = donnees.id;
    this.sessionId = donnees.sessionId;
    this.acheteurId = donnees.acheteurId;
    this.dateCreation = donnees.dateCreation;
    this.photoNumero = donnees.photoNumero;
    this.format = donnees.format;
    this.quantite = donnees.quantite;
    this.montantUnitaire = donnees.montantUnitaire;
  }

  static creer(params: {
    sessionId: string;
    acheteurId: string;
    photoNumero: number;
    format: Format;
    quantite: number;
    montantUnitaire: Montant;
    id?: string;
    dateCreation?: Date;
  }): Commande {
    return new Commande({
      id: params.id ?? crypto.randomUUID(),
      sessionId: params.sessionId,
      acheteurId: params.acheteurId,
      dateCreation: params.dateCreation ?? new Date(),
      photoNumero: params.photoNumero,
      format: params.format,
      quantite: params.quantite,
      montantUnitaire: params.montantUnitaire,
    });
  }

  total(): Montant {
    return this.montantUnitaire.multiplierPar(this.quantite);
  }

  nombreTirages(): number {
    return this.quantite;
  }

  /**
   * Produit la liste des fichiers à créer à l'export pour cette commande.
   * Chaque entrée = un sous-dossier (nommé par le format) + un nom de
   * fichier slugifié `{acheteur}_{photo}_{i}.jpg`.
   *
   * Le format `Numerique` partage la même logique que les formats
   * d'impression — si quantité = 3, on crée 3 copies dans `Numerique/`.
   *
   * Méthode PURE qui ne fait pas l'I/O : c'est le use case ExporterCommande
   * qui orchestre les copies à partir de ces instructions.
   */
  nomsFichiersExport(nomAcheteur: string): ReadonlyArray<{
    readonly sousDossier: string;
    readonly nomFichier: string;
  }> {
    const slug = slugifierNomAcheteur(nomAcheteur);
    const sousDossier = this.format.toDossierName();
    return Array.from({ length: this.quantite }, (_, i) => ({
      sousDossier,
      nomFichier: `${slug}_${this.photoNumero}_${i + 1}.jpg`,
    }));
  }
}

/**
 * Normalise un nom d'acheteur en slug compatible filesystem :
 * trim, lowercase, accents dépouillés, espaces → underscore, strip du
 * reste. Pur, testé, sans dépendance externe.
 */
export function slugifierNomAcheteur(nom: string): string {
  const slug = nom
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
  if (!slug) {
    throw new Error(
      `Nom d'acheteur vide après normalisation : "${nom}" n'a pas de caractère exploitable.`,
    );
  }
  return slug;
}
