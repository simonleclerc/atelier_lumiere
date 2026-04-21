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

export class AcheteurIntrouvableDansSession extends Error {
  constructor(acheteurId: string) {
    super(`Acheteur introuvable dans la session (id "${acheteurId}").`);
    this.name = "AcheteurIntrouvableDansSession";
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

interface InfosSession {
  commanditaire: string;
  referent: string;
  date: Date;
  type: TypeSession;
  dossierSource: CheminDossier;
  dossierExport: CheminDossier;
}

/**
 * Valide + normalise (trim) les infos éditables. Partagé entre le
 * constructeur et `modifierInfos` pour garder la règle à un seul endroit.
 */
function validerInfos(params: InfosSession): InfosSession {
  const commanditaire = params.commanditaire.trim();
  if (!commanditaire) {
    throw new Error("Session: commanditaire vide refusé.");
  }
  const referent = params.referent.trim();
  if (!referent) {
    throw new Error("Session: référent vide refusé.");
  }
  if (Number.isNaN(params.date.getTime())) {
    throw new Error("Session: date invalide.");
  }
  if (params.dossierSource.egale(params.dossierExport)) {
    throw new Error(
      "Session: dossier source et dossier export doivent être distincts (risque d'écrasement).",
    );
  }
  return {
    commanditaire,
    referent,
    date: params.date,
    type: params.type,
    dossierSource: params.dossierSource,
    dossierExport: params.dossierExport,
  };
}

export class Session {
  readonly id: string;
  // Champs éditables via `modifierInfos` — pas readonly pour que la méthode
  // puisse les muter après revalidation des invariants. Convention : seul
  // l'agrégat lui-même y touche, jamais un appelant externe directement.
  commanditaire: string;
  referent: string;
  date: Date;
  type: TypeSession;
  dossierSource: CheminDossier;
  dossierExport: CheminDossier;

  /**
   * Stockage mutable privé : l'agrégat racine a le droit d'évoluer son
   * état interne au fil du temps (ajout d'acheteurs, ajustement de la
   * grille tarifaire, rescan des photos du dossier source), mais
   * l'extérieur ne voit qu'une vue en lecture seule via les getters.
   */
  private _grilleTarifaire: GrilleTarifaire;
  private readonly _acheteurs: Acheteur[];
  private _photos: Photo[];

  constructor(donnees: SessionDonnees) {
    if (!donnees.id.trim()) {
      throw new Error("Session: id vide refusé.");
    }
    const infos = validerInfos(donnees);
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
    this.commanditaire = infos.commanditaire;
    this.referent = infos.referent;
    this.date = infos.date;
    this.type = infos.type;
    this.dossierSource = infos.dossierSource;
    this.dossierExport = infos.dossierExport;
    this._grilleTarifaire = donnees.grilleTarifaire;
    this._photos = [...donnees.photos].sort((a, b) => a.numero - b.numero);
    this._acheteurs = [...acheteurs];
  }

  get photos(): readonly Photo[] {
    return this._photos;
  }

  /**
   * Remplace la liste des photos (après un rescan du dossier source).
   * Retourne le diff pour que l'appelant puisse rapporter ce qui a
   * changé : `ajoutes` = nouveaux numéros apparus sur disque, `retires`
   * = numéros qui n'y sont plus. L'ordre interne est renormalisé.
   */
  remplacerPhotos(numeros: readonly number[]): {
    ajoutes: number[];
    retires: number[];
  } {
    const anciens = new Set(this._photos.map((p) => p.numero));
    const nouveaux = new Set<number>();
    for (const n of numeros) {
      if (Number.isInteger(n) && n >= 1) nouveaux.add(n);
    }
    const ajoutes = [...nouveaux].filter((n) => !anciens.has(n)).sort(
      (a, b) => a - b,
    );
    const retires = [...anciens].filter((n) => !nouveaux.has(n)).sort(
      (a, b) => a - b,
    );
    this._photos = [...nouveaux]
      .sort((a, b) => a - b)
      .map((n) => new Photo(n));
    return { ajoutes, retires };
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

  /**
   * Édite les infos de la session. Revalide TOUS les invariants de ces
   * champs via `validerInfos` — si un utilisateur met le même dossier en
   * source et export par erreur, c'est refusé comme à la création.
   *
   * NE RESCANNE PAS le dossier source : la collection `photos` reste
   * inchangée. Pour rafraîchir les photos après un changement de dossier
   * source, un futur use case `RescannerDossierSource` sera nécessaire.
   */
  modifierInfos(params: InfosSession): void {
    const infos = validerInfos(params);
    this.commanditaire = infos.commanditaire;
    this.referent = infos.referent;
    this.date = infos.date;
    this.type = infos.type;
    this.dossierSource = infos.dossierSource;
    this.dossierExport = infos.dossierExport;
  }

  /**
   * Édite un acheteur fille. Comme pour `ajouterAcheteur`, l'invariant
   * d'unicité du nom dans la session est revalidé ICI — on exclut l'acheteur
   * lui-même de la comparaison pour ne pas détecter son propre nom comme
   * conflit.
   *
   * L'Acheteur étant immutable, on reconstruit une nouvelle instance avec
   * le même id et on remplace dans la collection. L'id stable garantit
   * que les commandes qui référencent cet acheteur continuent de pointer
   * sur la bonne entité après l'édition.
   */
  modifierAcheteur(
    acheteurId: string,
    params: { nom: string; email?: string; telephone?: string },
  ): Acheteur {
    const index = this._acheteurs.findIndex((a) => a.id === acheteurId);
    if (index === -1) {
      throw new AcheteurIntrouvableDansSession(acheteurId);
    }
    const nomCible = normaliserNom(params.nom);
    const conflit = this._acheteurs.some(
      (a, i) => i !== index && normaliserNom(a.nom) === nomCible,
    );
    if (conflit) {
      throw new NomAcheteurDejaUtiliseDansSession(params.nom.trim());
    }
    const nouveau = Acheteur.creer({
      id: acheteurId,
      nom: params.nom,
      email: params.email,
      telephone: params.telephone,
    });
    this._acheteurs[index] = nouveau;
    return nouveau;
  }
}
