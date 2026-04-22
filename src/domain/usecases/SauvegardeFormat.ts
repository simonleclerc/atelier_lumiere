import { Acheteur } from "../entities/Acheteur";
import { Commande } from "../entities/Commande";
import { Photo } from "../entities/Photo";
import { Session } from "../entities/Session";
import { Tirage } from "../entities/Tirage";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Email } from "../value-objects/Email";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import {
  StatutExport,
  type NatureStatutExport,
} from "../value-objects/StatutExport";
import { parseTypeSession } from "../value-objects/TypeSession";

/**
 * Schéma de sauvegarde — format JSON propre à l'export/import utilisateur,
 * **indépendant** des schémas internes des adapters de persistance.
 *
 * Versionné pour supporter les migrations futures. Si on change le modèle
 * (ex : ajout d'un champ sur Tirage), on incrémente `VERSION_COURANTE` et
 * on ajoute une branche de migration dans `desserialiser`.
 *
 * Ce fichier vit dans `usecases/` (et non `infrastructure/`) parce qu'il
 * est manipulé par des use cases purs — la sérialisation est une
 * responsabilité domaine quand elle porte des règles métier (versioning,
 * rétrocompatibilité). L'infrastructure n'est concernée que par le
 * transport (lire/écrire le fichier texte).
 */

export const VERSION_COURANTE = 1;
const MARQUEUR = "atelier_lumiere";

export class SauvegardeInvalide extends Error {
  constructor(raison: string) {
    super(`Sauvegarde invalide : ${raison}.`);
    this.name = "SauvegardeInvalide";
  }
}

interface GrilleJson {
  readonly format: string;
  readonly centimes: number;
}

interface AcheteurJson {
  readonly id: string;
  readonly nom: string;
  readonly email?: string;
  readonly telephone?: string;
}

interface SessionJson {
  readonly id: string;
  readonly commanditaire: string;
  readonly referent: string;
  readonly date: string;
  readonly type: string;
  readonly dossierSource: string;
  readonly dossierExport: string;
  readonly grilleTarifaire: readonly GrilleJson[];
  readonly photos: readonly number[];
  readonly acheteurs: readonly AcheteurJson[];
  readonly archivee?: boolean;
}

interface TirageJson {
  readonly id: string;
  readonly photoNumero: number;
  readonly format: string;
  readonly quantite: number;
}

interface StatutJson {
  readonly nature: NatureStatutExport;
  readonly messageErreur?: string;
}

interface CommandeJson {
  readonly id: string;
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly dateCreation: string;
  readonly tirages: readonly TirageJson[];
  readonly statut?: StatutJson;
}

interface SauvegardeJson {
  readonly version: number;
  readonly exportePar: string;
  readonly dateExport: string;
  readonly sessions: readonly SessionJson[];
  readonly commandes: readonly CommandeJson[];
}

export interface SauvegardeEnMemoire {
  readonly sessions: readonly Session[];
  readonly commandes: readonly Commande[];
}

export function serialiser(donnees: SauvegardeEnMemoire): string {
  const payload: SauvegardeJson = {
    version: VERSION_COURANTE,
    exportePar: MARQUEUR,
    dateExport: new Date().toISOString(),
    sessions: donnees.sessions.map(sessionVersJson),
    commandes: donnees.commandes.map(commandeVersJson),
  };
  return JSON.stringify(payload, null, 2);
}

export function desserialiser(contenu: string): SauvegardeEnMemoire {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contenu);
  } catch (err) {
    throw new SauvegardeInvalide(
      `contenu non JSON${err instanceof Error ? ` (${err.message})` : ""}`,
    );
  }
  if (!estSauvegardeJson(parsed)) {
    throw new SauvegardeInvalide(
      "schéma inattendu — ce fichier n'est pas une sauvegarde atelier_lumiere",
    );
  }
  if (parsed.version !== VERSION_COURANTE) {
    throw new SauvegardeInvalide(
      `version ${parsed.version} non supportée (attendu ${VERSION_COURANTE})`,
    );
  }
  try {
    return {
      sessions: parsed.sessions.map(sessionDepuisJson),
      commandes: parsed.commandes.map(commandeDepuisJson),
    };
  } catch (err) {
    throw new SauvegardeInvalide(
      `reconstitution du domaine impossible${err instanceof Error ? ` : ${err.message}` : ""}`,
    );
  }
}

function sessionVersJson(session: Session): SessionJson {
  return {
    id: session.id,
    commanditaire: session.commanditaire,
    referent: session.referent,
    date: session.date.toISOString(),
    type: session.type,
    dossierSource: session.dossierSource.valeur,
    dossierExport: session.dossierExport.valeur,
    grilleTarifaire: session.grilleTarifaire
      .toEntrees()
      .map(([f, m]) => ({ format: f.toDossierName(), centimes: m.centimes })),
    photos: session.photos.map((p) => p.numero),
    acheteurs: session.acheteurs.map((a) => ({
      id: a.id,
      nom: a.nom,
      email: a.email?.valeur,
      telephone: a.telephone,
    })),
    archivee: session.archivee,
  };
}

function sessionDepuisJson(raw: SessionJson): Session {
  return new Session({
    id: raw.id,
    commanditaire: raw.commanditaire,
    referent: raw.referent,
    date: new Date(raw.date),
    type: parseTypeSession(raw.type),
    dossierSource: new CheminDossier(raw.dossierSource),
    dossierExport: new CheminDossier(raw.dossierExport),
    grilleTarifaire: new GrilleTarifaire(
      raw.grilleTarifaire.map(
        (e) => [Format.depuis(e.format), new Montant(e.centimes)] as const,
      ),
    ),
    photos: raw.photos.map((n) => new Photo(n)),
    acheteurs: raw.acheteurs.map(
      (a) =>
        new Acheteur({
          id: a.id,
          nom: a.nom,
          email: a.email ? new Email(a.email) : undefined,
          telephone: a.telephone,
        }),
    ),
    archivee: raw.archivee ?? false,
  });
}

function commandeVersJson(commande: Commande): CommandeJson {
  const statut = commande.statut;
  return {
    id: commande.id,
    sessionId: commande.sessionId,
    acheteurId: commande.acheteurId,
    dateCreation: commande.dateCreation.toISOString(),
    tirages: commande.tirages.map((t) => ({
      id: t.id,
      photoNumero: t.photoNumero,
      format: t.format.toDossierName(),
      quantite: t.quantite,
    })),
    statut: { nature: statut.nature, messageErreur: statut.messageErreur },
  };
}

function commandeDepuisJson(raw: CommandeJson): Commande {
  return new Commande({
    id: raw.id,
    sessionId: raw.sessionId,
    acheteurId: raw.acheteurId,
    dateCreation: new Date(raw.dateCreation),
    tirages: raw.tirages.map(
      (t) =>
        new Tirage({
          id: t.id,
          photoNumero: t.photoNumero,
          format: Format.depuis(t.format),
          quantite: t.quantite,
        }),
    ),
    statut: statutDepuisJson(raw.statut),
  });
}

function statutDepuisJson(raw: StatutJson | undefined): StatutExport {
  if (!raw) return StatutExport.pasExporte();
  switch (raw.nature) {
    case "complet":
      return StatutExport.complet();
    case "incomplet":
      return StatutExport.incomplet();
    case "erreur":
      return StatutExport.enErreur(raw.messageErreur ?? "");
    case "pas-exporte":
    default:
      return StatutExport.pasExporte();
  }
}

function estSauvegardeJson(item: unknown): item is SauvegardeJson {
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  return (
    typeof o.version === "number" &&
    o.exportePar === MARQUEUR &&
    typeof o.dateExport === "string" &&
    Array.isArray(o.sessions) &&
    Array.isArray(o.commandes)
  );
}
