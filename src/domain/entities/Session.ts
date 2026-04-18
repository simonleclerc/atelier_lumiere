import { CheminDossier } from "../value-objects/CheminDossier";
import type { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import type { Montant } from "../value-objects/Montant";
import type { TypeSession } from "../value-objects/TypeSession";
import { Acheteur } from "./Acheteur";
import { Photo } from "./Photo";

/**
 * Agrégat racine (DDD, Evans) — point d'entrée unique pour manipuler tout
 * ce qui appartient à une session photo : ses Photos et ses Acheteurs.
 *
 * Les Acheteurs ont été "remontés" d'agrégat racine autonome à entité fille
 * de Session à la demande du métier : un acheteur n'a pas de sens hors
 * d'une session (pas de réutilisation cross-session voulue). Même mouvement
 * que Photo. Conséquence pédagogique : l'invariant d'unicité du nom quitte
 * le use case et revient DANS l'agrégat, via `ajouterAcheteur`. Un même
 * invariant métier peut vivre à deux endroits différents selon le scope
 * qu'on lui donne (collection globale → use case ; scope d'agrégat → entité).
 *
 * Invariants protégés par le constructeur :
 *  - id, commanditaire, référent : non vides
 *  - date : valide
 *  - dossier source ≠ dossier export (sinon on écraserait les originaux)
 *  - numéros de photos uniques
 *  - noms d'acheteurs uniques (trim + case-insensitive)
 */
export class NomAcheteurDejaUtiliseDansSession extends Error {
  constructor(nom: string) {
    super(
      `Un acheteur nommé "${nom}" est déjà inscrit sur cette session. Utilise un nom plus précis (ex : "${nom} Dupont").`,
    );
    this.name = "NomAcheteurDejaUtiliseDansSession";
  }
}

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
  readonly acheteurs?: readonly Acheteur[];
}

function normaliserNom(nom: string): string {
  return nom.trim().toLowerCase();
}

export class Session {
  readonly id: string;
  readonly commanditaire: string;
  readonly referent: string;
  readonly date: Date;
  readonly type: TypeSession;
  readonly dossierSource: CheminDossier;
  readonly dossierExport: CheminDossier;
  readonly photos: readonly Photo[];

  /**
   * Stockage mutable privé : l'agrégat racine a le droit d'évoluer son
   * état interne au fil du temps (ajout d'acheteurs, ajustement de la
   * grille tarifaire), mais l'extérieur ne voit qu'une vue en lecture
   * seule via les getters.
   */
  private _grilleTarifaire: GrilleTarifaire;
  private readonly _acheteurs: Acheteur[];

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
    const acheteurs = donnees.acheteurs ?? [];
    const nomsNormalises = acheteurs.map((a) => normaliserNom(a.nom));
    if (new Set(nomsNormalises).size !== nomsNormalises.length) {
      throw new Error("Session: noms d'acheteurs dupliqués.");
    }

    this.id = donnees.id;
    this.commanditaire = commanditaire;
    this.referent = referent;
    this.date = donnees.date;
    this.type = donnees.type;
    this.dossierSource = donnees.dossierSource;
    this.dossierExport = donnees.dossierExport;
    this._grilleTarifaire = donnees.grilleTarifaire;
    this.photos = [...donnees.photos].sort((a, b) => a.numero - b.numero);
    this._acheteurs = [...acheteurs];
  }

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
      acheteurs: [],
    });
  }

  get acheteurs(): readonly Acheteur[] {
    return this._acheteurs;
  }

  get grilleTarifaire(): GrilleTarifaire {
    return this._grilleTarifaire;
  }

  nombrePhotos(): number {
    return this.photos.length;
  }

  /**
   * Ajuste le prix d'un format pour CETTE session. Remplace le VO grille
   * entier (évolution immutable du VO) ; seule la référence interne de
   * l'agrégat évolue.
   *
   * Note importante pour la suite : modifier la grille n'impactera PAS
   * les commandes déjà émises, parce qu'une LigneCommande capturera son
   * montant au moment de sa création (pattern "snapshot" en DDD).
   */
  modifierPrix(format: Format, montant: Montant): void {
    this._grilleTarifaire = this._grilleTarifaire.avecPrixModifie(
      format,
      montant,
    );
  }

  /**
   * Invariant d'agrégat : le nom doit être unique dans la session (trim +
   * case-insensitive). La règle vit ICI parce qu'elle est scopée à l'agrégat
   * — l'info nécessaire pour la vérifier est dans la Session elle-même, pas
   * dans un repo externe.
   */
  ajouterAcheteur(params: {
    nom: string;
    email?: string;
    telephone?: string;
  }): Acheteur {
    const nomCible = normaliserNom(params.nom);
    if (this._acheteurs.some((a) => normaliserNom(a.nom) === nomCible)) {
      throw new NomAcheteurDejaUtiliseDansSession(params.nom.trim());
    }
    const acheteur = Acheteur.creer(params);
    this._acheteurs.push(acheteur);
    return acheteur;
  }
}
