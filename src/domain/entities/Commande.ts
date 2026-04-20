import type { Format } from "../value-objects/Format";
import { Montant } from "../value-objects/Montant";
import { Tirage } from "./Tirage";

/**
 * Agrégat racine — la commande d'UN acheteur dans UNE session.
 *
 * Contrainte métier cruciale : il y a au plus UNE commande par couple
 * `(sessionId, acheteurId)`. C'est une règle **cross-aggregate** (Commande
 * et Session sont deux agrégats distincts), garantie par le use case
 * `AjouterTirageACommande` qui fait un upsert via
 * `CommandeRepository.findByAcheteur`.
 *
 * Contenu : une collection de **Tirages** (terme métier du photographe,
 * pas "lignes"). Invariant d'agrégat : unicité de `(photoNumero, format)`
 * dans les tirages — à l'ajout, si le couple existe déjà, on consolide
 * en incrémentant la quantité plutôt que de créer un doublon.
 *
 * Cycle de vie implicite : la Commande naît quand on lui ajoute son
 * premier tirage, et doit être supprimée quand on retire son dernier
 * (pour éviter les commandes fantômes vides). `retirerTirage` signale
 * au use case appelant via son booléen de retour.
 */
export class TirageIntrouvable extends Error {
  constructor(tirageId: string) {
    super(`Tirage introuvable pour l'id "${tirageId}".`);
    this.name = "TirageIntrouvable";
  }
}

export interface CommandeDonnees {
  readonly id: string;
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly dateCreation: Date;
  readonly tirages?: readonly Tirage[];
}

export class Commande {
  readonly id: string;
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly dateCreation: Date;

  private _tirages: Tirage[];

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
    this._tirages = [...(donnees.tirages ?? [])];
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
      tirages: [],
    });
  }

  get tirages(): readonly Tirage[] {
    return this._tirages;
  }

  /**
   * Ajoute un tirage à la commande, avec CONSOLIDATION : si un tirage
   * existant a le même `(photoNumero, format)`, sa quantité est
   * incrémentée. Sinon on crée un nouveau Tirage.
   *
   * Le `montantUnitaire` passé est utilisé uniquement si on crée un
   * nouveau Tirage — la consolidation ne re-calcule pas le prix, on
   * conserve celui du snapshot d'origine. Règle métier : si la grille a
   * changé entre l'ajout initial et la consolidation, le prix unitaire
   * de la consolidation reste celui du premier ajout.
   */
  ajouterTirage(params: {
    photoNumero: number;
    format: Format;
    quantite: number;
    montantUnitaire: Montant;
  }): Tirage {
    const indexExistant = this._tirages.findIndex((t) =>
      t.egaleContenu(params.photoNumero, params.format),
    );
    if (indexExistant !== -1) {
      const consolide = this._tirages[indexExistant].avecQuantiteCumulee(
        params.quantite,
      );
      this._tirages[indexExistant] = consolide;
      return consolide;
    }
    const nouveau = Tirage.creer({
      photoNumero: params.photoNumero,
      format: params.format,
      quantite: params.quantite,
      montantUnitaire: params.montantUnitaire,
    });
    this._tirages.push(nouveau);
    return nouveau;
  }

  /**
   * Retire un tirage par son id.
   *
   * Retourne `{ devenueVide: true }` si la commande n'a plus aucun tirage
   * après le retrait, pour signaler au use case appelant qu'il peut
   * supprimer la Commande elle-même (création et suppression implicites
   * forment un couple cohérent).
   */
  retirerTirage(tirageId: string): { devenueVide: boolean } {
    const index = this._tirages.findIndex((t) => t.id === tirageId);
    if (index === -1) throw new TirageIntrouvable(tirageId);
    this._tirages.splice(index, 1);
    return { devenueVide: this._tirages.length === 0 };
  }

  estVide(): boolean {
    return this._tirages.length === 0;
  }

  total(): Montant {
    return this._tirages.reduce(
      (somme, t) => somme.ajouter(t.total()),
      new Montant(0),
    );
  }

  nombreTirages(): number {
    return this._tirages.reduce((n, t) => n + t.quantite, 0);
  }

  /**
   * Produit les instructions d'export pour tous les tirages de la
   * commande, à plat. Pour chaque tirage, une entrée par exemplaire
   * (selon la quantité), nommée `{acheteur}_{photo}_{i}.jpg` dans le
   * sous-dossier correspondant au format.
   *
   * Méthode PURE — le use case ExporterCommande orchestre les copies
   * réelles à partir de ces instructions.
   */
  nomsFichiersExport(nomAcheteur: string): ReadonlyArray<{
    readonly sousDossier: string;
    readonly nomFichier: string;
    readonly photoNumero: number;
  }> {
    const slug = slugifierNomAcheteur(nomAcheteur);
    const instructions: Array<{
      sousDossier: string;
      nomFichier: string;
      photoNumero: number;
    }> = [];
    for (const tirage of this._tirages) {
      const sousDossier = tirage.format.toDossierName();
      for (let i = 0; i < tirage.quantite; i += 1) {
        instructions.push({
          sousDossier,
          nomFichier: `${slug}_${tirage.photoNumero}_${i + 1}.jpg`,
          photoNumero: tirage.photoNumero,
        });
      }
    }
    return instructions;
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
