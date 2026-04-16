import { CheminDossier } from "../value-objects/CheminDossier";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import type { TypeSession } from "../value-objects/TypeSession";
import { Photo } from "./Photo";

/**
 * Agrégat racine (DDD, Evans) — point d'entrée unique pour manipuler tout
 * ce qui appartient à une session photo. Toutes les modifications aux Photo
 * filles passent par la Session, jamais directement. Ça garantit que les
 * invariants (numéros uniques, par exemple) sont toujours vérifiés.
 *
 * Invariants protégés par le constructeur :
 *  - id, commanditaire, référent : non vides
 *  - date : valide
 *  - dossier source ≠ dossier export (sinon on écraserait les originaux)
 *  - numéros de photos uniques
 *
 * Règle DDD : les invariants vivent ICI, pas dans l'UI ni dans le use case.
 * Une Session qu'on arrive à construire est, par définition, valide.
 */
export interface SessionDonnees {
  readonly id: string;
  readonly commanditaire: string;
  readonly referent: string;
  readonly date: Date;
  readonly type: TypeSession;
  readonly dossierSource: CheminDossier;
  readonly dossierExport: CheminDossier;
  readonly grilleTarifaire: GrilleTarifaire;
  readonly photos: readonly Photo[];
}

export class Session {
  readonly id: string;
  readonly commanditaire: string;
  readonly referent: string;
  readonly date: Date;
  readonly type: TypeSession;
  readonly dossierSource: CheminDossier;
  readonly dossierExport: CheminDossier;
  readonly grilleTarifaire: GrilleTarifaire;
  readonly photos: readonly Photo[];

  constructor(donnees: SessionDonnees) {
    if (!donnees.id.trim()) {
      throw new Error("Session: id vide refusé.");
    }
    const commanditaire = donnees.commanditaire.trim();
    if (!commanditaire) {
      throw new Error("Session: commanditaire vide refusé.");
    }
    const referent = donnees.referent.trim();
    if (!referent) {
      throw new Error("Session: référent vide refusé.");
    }
    if (Number.isNaN(donnees.date.getTime())) {
      throw new Error("Session: date invalide.");
    }
    if (donnees.dossierSource.egale(donnees.dossierExport)) {
      throw new Error(
        "Session: dossier source et dossier export doivent être distincts (risque d'écrasement).",
      );
    }
    const numeros = donnees.photos.map((p) => p.numero);
    if (new Set(numeros).size !== numeros.length) {
      throw new Error("Session: numéros de photos dupliqués.");
    }

    this.id = donnees.id;
    this.commanditaire = commanditaire;
    this.referent = referent;
    this.date = donnees.date;
    this.type = donnees.type;
    this.dossierSource = donnees.dossierSource;
    this.dossierExport = donnees.dossierExport;
    this.grilleTarifaire = donnees.grilleTarifaire;
    this.photos = [...donnees.photos].sort((a, b) => a.numero - b.numero);
  }

  /**
   * Factory — crée une nouvelle Session avec un id fraîchement généré.
   *
   * On sépare `new Session(donnees)` (utilisé notamment par le repository
   * pour reconstituer un objet depuis le JSON persisté, avec son id existant)
   * de `Session.creer(...)` (création business d'une session neuve).
   * Pattern "reconstitution vs création" — utile dès qu'on persiste.
   */
  static creer(params: {
    commanditaire: string;
    referent: string;
    date: Date;
    type: TypeSession;
    dossierSource: CheminDossier;
    dossierExport: CheminDossier;
    grilleTarifaire: GrilleTarifaire;
    photoNumeros: readonly number[];
    id?: string;
  }): Session {
    return new Session({
      id: params.id ?? crypto.randomUUID(),
      commanditaire: params.commanditaire,
      referent: params.referent,
      date: params.date,
      type: params.type,
      dossierSource: params.dossierSource,
      dossierExport: params.dossierExport,
      grilleTarifaire: params.grilleTarifaire,
      photos: params.photoNumeros.map((n) => new Photo(n)),
    });
  }

  nombrePhotos(): number {
    return this.photos.length;
  }
}
