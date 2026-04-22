import type { Format } from "../value-objects/Format";
import type { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { StatutExport } from "../value-objects/StatutExport";
import { Tirage } from "./Tirage";

/**
 * Agrégat racine — la commande d'UN acheteur dans UNE session.
 *
 * Contrainte métier : il y a au plus UNE commande par couple
 * `(sessionId, acheteurId)`. C'est une règle **cross-aggregate**, garantie
 * par le use case `AjouterTirageACommande` qui fait un upsert via
 * `CommandeRepository.findByAcheteur`.
 *
 * Contenu : une collection de **Tirages**. Invariant d'agrégat : unicité
 * de `(photoNumero, format)` dans les tirages — à l'ajout, si le couple
 * existe déjà, on consolide en incrémentant la quantité plutôt que de
 * créer un doublon.
 *
 * **Pas de prix stocké** sur les tirages (tant qu'on n'a pas de facture).
 * Les méthodes `total` et `totalPourTirage` prennent la `GrilleTarifaire`
 * en paramètre et lisent les prix à la volée — conséquence : modifier la
 * grille d'une session fait bouger immédiatement les totaux des commandes
 * existantes. Quand on introduira les factures, on figera le snapshot
 * sur l'entité `Facture`, pas ici.
 *
 * Cycle de vie implicite : la Commande naît quand on lui ajoute son
 * premier tirage, et doit être supprimée quand on retire son dernier.
 * `retirerTirage` signale via son booléen de retour.
 */
export class TirageIntrouvable extends Error {
  constructor(tirageId: string) {
    super(`Tirage introuvable pour l'id "${tirageId}".`);
    this.name = "TirageIntrouvable";
  }
}

/**
 * Invariant métier : un fichier numérique se commande en 1 exemplaire
 * maximum par photo (rien ne justifie 2 copies d'un fichier digital). Le
 * buyer peut en revanche avoir du numérique sur plusieurs photos
 * différentes, chacune en 1 seul exemplaire.
 */
export class QuantiteNumeriqueInvalide extends Error {
  constructor(photoNumero: number) {
    super(
      `Un tirage numérique est limité à 1 exemplaire (photo n°${photoNumero}).`,
    );
    this.name = "QuantiteNumeriqueInvalide";
  }
}

/**
 * Règle métier à l'export : les tirages numériques sont livrés par
 * email (un sous-dossier par acheteur dans `Numerique/`), donc un
 * acheteur sans email ne peut pas voir ses numériques exportés. La
 * validation vit dans `Commande.nomsFichiersExport` parce qu'elle
 * dépend de la convention de nommage/rangement côté export, pas d'un
 * invariant intrinsèque à la Commande (ajouter un tirage numérique à
 * un acheteur sans email reste autorisé — l'utilisateur peut
 * compléter l'email avant d'exporter).
 */
export class EmailAcheteurRequisPourNumerique extends Error {
  constructor(nomAcheteur: string) {
    super(
      `L'acheteur "${nomAcheteur}" doit avoir un email pour exporter ses tirages numériques : ils sont rangés dans un sous-dossier portant son email.`,
    );
    this.name = "EmailAcheteurRequisPourNumerique";
  }
}

export interface CommandeDonnees {
  readonly id: string;
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly dateCreation: Date;
  readonly tirages?: readonly Tirage[];
  readonly statut?: StatutExport;
}

export class Commande {
  readonly id: string;
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly dateCreation: Date;

  private _tirages: Tirage[];
  private _statut: StatutExport;

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
    this._statut = donnees.statut ?? StatutExport.pasExporte();
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

  get statut(): StatutExport {
    return this._statut;
  }

  /**
   * Ajoute un tirage à la commande, avec CONSOLIDATION : si un tirage
   * existant a le même `(photoNumero, format)`, sa quantité est
   * incrémentée. Sinon on crée un nouveau Tirage.
   */
  ajouterTirage(params: {
    photoNumero: number;
    format: Format;
    quantite: number;
  }): Tirage {
    const indexExistant = this._tirages.findIndex((t) =>
      t.egaleContenu(params.photoNumero, params.format),
    );
    const quantiteExistante =
      indexExistant !== -1 ? this._tirages[indexExistant].quantite : 0;
    const quantiteFinale = quantiteExistante + params.quantite;
    if (params.format.estNumerique() && quantiteFinale > 1) {
      throw new QuantiteNumeriqueInvalide(params.photoNumero);
    }
    let impacte: Tirage;
    if (indexExistant !== -1) {
      const consolide = this._tirages[indexExistant].avecQuantiteCumulee(
        params.quantite,
      );
      this._tirages[indexExistant] = consolide;
      impacte = consolide;
    } else {
      impacte = Tirage.creer({
        photoNumero: params.photoNumero,
        format: params.format,
        quantite: params.quantite,
      });
      this._tirages.push(impacte);
    }
    this.invaliderStatutSiExporte();
    return impacte;
  }

  /**
   * Retire un tirage par son id.
   *
   * Retourne `{ devenueVide: true }` si la commande n'a plus aucun tirage
   * après le retrait, pour signaler au use case appelant qu'il peut
   * supprimer la Commande elle-même.
   */
  retirerTirage(tirageId: string): { devenueVide: boolean } {
    const index = this._tirages.findIndex((t) => t.id === tirageId);
    if (index === -1) throw new TirageIntrouvable(tirageId);
    this._tirages.splice(index, 1);
    this.invaliderStatutSiExporte();
    return { devenueVide: this._tirages.length === 0 };
  }

  /**
   * Après un export réussi. Le statut passe inconditionnellement à complet.
   */
  enregistrerExportReussi(): void {
    this._statut = StatutExport.complet();
  }

  /**
   * Après un export qui a levé. On stocke le message pour l'UI.
   */
  enregistrerExportEchec(message: string): void {
    this._statut = StatutExport.enErreur(message);
  }

  /**
   * Transition automatique au sein de l'agrégat quand on ajoute/retire un
   * tirage : si on était `complet` (fichiers physiques en phase avec le
   * contenu), on passe à `incomplet` (les fichiers ne reflètent plus
   * l'état actuel). Les autres états ne bougent pas :
   *  - `pas-exporte` → reste (aucun export n'a jamais été lancé)
   *  - `incomplet` → reste (déjà désynchro, on continue de l'être)
   *  - `erreur` → reste (l'utilisateur sait que c'est cassé, modifier le
   *    contenu ne résout pas l'erreur tant qu'il n'a pas re-tenté)
   */
  private invaliderStatutSiExporte(): void {
    if (this._statut.estComplet()) {
      this._statut = StatutExport.incomplet();
    }
  }

  estVide(): boolean {
    return this._tirages.length === 0;
  }

  /**
   * Total de la commande, lu à la volée dans la grille. Si la grille
   * change, le total change aussi — comportement voulu tant qu'on n'a
   * pas de factures.
   */
  total(grille: GrilleTarifaire): Montant {
    return this._tirages.reduce(
      (somme, t) => somme.ajouter(t.total(grille)),
      new Montant(0),
    );
  }

  nombreTirages(): number {
    return this._tirages.reduce((n, t) => n + t.quantite, 0);
  }

  /**
   * Produit les instructions d'export pour tous les tirages de la
   * commande, à plat. Pour chaque tirage, une entrée par exemplaire
   * (selon la quantité), nommée
   * `{slug}{indexGlobal}.{photoNumero}.{exemplaireDansTirage}.jpg`
   * dans le sous-dossier correspondant au format.
   *
   * Trois segments numériques, séparés par des points :
   *  - `indexGlobal` — compteur plat sur TOUS les exemplaires de la
   *    commande (ordre d'insertion des tirages × quantité). Permet de
   *    voir d'un coup d'œil combien de tirages un acheteur a commandés.
   *  - `photoNumero` — identifiant de la photo source.
   *  - `exemplaireDansTirage` — compteur local au tirage (1..quantite),
   *    qui repart à 1 dans chaque tirage même si la photoNumero est la
   *    même (cas d'une photo commandée dans deux formats différents).
   *
   * Cas particulier du format **numérique** : `sousDossier` vaut
   * `Numerique/{email}` plutôt que `Numerique` — les fichiers digitaux
   * sont rangés par acheteur pour simplifier la livraison (envoi email
   * individuel). Si l'acheteur n'a pas d'email, la méthode lève
   * `EmailAcheteurRequisPourNumerique` — l'utilisateur doit compléter
   * l'email avant de pouvoir exporter.
   *
   * Méthode PURE — le use case ExporterCommande orchestre les copies
   * réelles à partir de ces instructions.
   */
  nomsFichiersExport(acheteur: {
    readonly nom: string;
    readonly email?: string;
  }): ReadonlyArray<{
    readonly sousDossier: string;
    readonly nomFichier: string;
    readonly photoNumero: number;
  }> {
    const slug = slugifierNomAcheteur(acheteur.nom);
    const emailNormalise = acheteur.email?.trim().toLowerCase();
    const instructions: Array<{
      sousDossier: string;
      nomFichier: string;
      photoNumero: number;
    }> = [];
    let indexGlobal = 0;
    for (const tirage of this._tirages) {
      const sousDossier = sousDossierPourTirage(
        tirage.format,
        emailNormalise,
        acheteur.nom,
      );
      for (let i = 0; i < tirage.quantite; i += 1) {
        indexGlobal += 1;
        instructions.push({
          sousDossier,
          nomFichier: `${slug}${indexGlobal}.${tirage.photoNumero}.${i + 1}.jpg`,
          photoNumero: tirage.photoNumero,
        });
      }
    }
    return instructions;
  }
}

function sousDossierPourTirage(
  format: Format,
  emailNormalise: string | undefined,
  nomAcheteur: string,
): string {
  const base = format.toDossierName();
  if (!format.estNumerique()) return base;
  if (!emailNormalise) {
    throw new EmailAcheteurRequisPourNumerique(nomAcheteur);
  }
  return `${base}/${emailNormalise}`;
}

/**
 * Prédicat pur — est-ce qu'un nom de fichier (sans chemin) correspond
 * au pattern d'export pour le slug donné ? Encapsule la convention de
 * nommage `{slug}{indexGlobal}.{photoNumero}.{exemplaire}.jpg` pour
 * que les use cases puissent filtrer le contenu d'un dossier sans la
 * redupliquer.
 *
 * Match STRICT : "martin" ne matche PAS "martin_dupont47.1.1.jpg" car
 * après le slug on attend immédiatement des chiffres (pas `_dupont`).
 *
 * Limite connue : si deux acheteurs ont des slugs où l'un est préfixe
 * de l'autre AVEC un suffixe numérique (ex : "martin" et "martin2"),
 * le fichier "martin247.1.1.jpg" matche les deux slugs. En pratique
 * le slugifier normalise les espaces en underscore, donc "Martin 2"
 * devient "martin_2" et la collision ne survient que si un nom humain
 * contient un chiffre collé à des lettres — cas très rare.
 */
export function estFichierExportDeSlug(
  nomFichier: string,
  slug: string,
): boolean {
  const slugEchappe = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${slugEchappe}\\d+\\.\\d+\\.\\d+\\.jpg$`);
  return regex.test(nomFichier);
}

/**
 * Parsing inverse de la convention d'export : depuis un nom de fichier
 * `{slug}{indexGlobal}.{photoNumero}.{exemplaire}.jpg`, extrait ses
 * quatre composants. Retourne `null` si le nom ne suit pas la
 * convention (fichier hors scope, ex : `.DS_Store`, `notes.txt`,
 * `martin_abc.jpg`).
 *
 * Utilisé par le contrôle de cohérence pour inspecter les fichiers
 * orphelins du dossier export sans avoir à connaître la liste des
 * slugs en amont. Le `.+?` non-greedy prend le slug le plus court
 * possible, laissant un maximum de chiffres à `indexGlobal` — choix
 * arbitraire en cas d'ambiguïté (slug terminant par un chiffre).
 */
export function parserNomFichierExport(
  nomFichier: string,
): {
  slug: string;
  indexGlobal: number;
  photoNumero: number;
  exemplaire: number;
} | null {
  const match = /^(.+?)(\d+)\.(\d+)\.(\d+)\.jpg$/.exec(nomFichier);
  if (!match) return null;
  const indexGlobal = Number.parseInt(match[2], 10);
  const photoNumero = Number.parseInt(match[3], 10);
  const exemplaire = Number.parseInt(match[4], 10);
  if (!Number.isInteger(indexGlobal) || indexGlobal < 1) return null;
  if (!Number.isInteger(photoNumero) || photoNumero < 1) return null;
  if (!Number.isInteger(exemplaire) || exemplaire < 1) return null;
  return { slug: match[1], indexGlobal, photoNumero, exemplaire };
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
