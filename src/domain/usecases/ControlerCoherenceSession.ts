import {
  parserNomFichierExport,
  slugifierNomAcheteur,
} from "../entities/Commande";
import type { CommandeRepository } from "../ports/CommandeRepository";
import type { FileLister } from "../ports/FileLister";
import type { SessionRepository } from "../ports/SessionRepository";
import { Format } from "../value-objects/Format";
import { joinChemin } from "./ExporterCommande";

/**
 * Use case — contrôle de cohérence au niveau session.
 *
 * **Read model** (lecture seule, pattern CQRS côté query) : croise les
 * commandes de la session avec le contenu réel du `dossierSource` et du
 * `dossierExport`, et produit un diagnostic en 3 catégories :
 *
 *  1. `photosFantomes` — des tirages référencent une photo qui n'existe
 *     plus dans le dossier source. Action attendue : retirer ces tirages.
 *  2. `exportsIncomplets` — la commande a bien sa photo en source, mais
 *     au moins un des fichiers d'export attendus n'est pas présent sur
 *     disque (statut "complet" mais fichier supprimé à la main, export
 *     jamais fait, etc.). Action attendue : ré-exporter.
 *  3. `orphelinsExport` — fichiers du `dossierExport` au format
 *     `{slug}_N_i.jpg` qui ne correspondent à AUCUN tirage courant
 *     (restes d'acheteurs supprimés, tirages retirés sans ré-export,
 *     slugs d'anciens noms après renommage). Action attendue :
 *     suppression opt-in par l'utilisateur.
 *
 * **Le dossier source reste intouchable** — on ne propose jamais d'y
 * supprimer quoi que ce soit. Seuls les exports (reproductions) peuvent
 * être nettoyés.
 *
 * C'est l'un des rares cas où un use case lit plusieurs agrégats pour
 * produire un DTO agrégé. Pas de mutation ; toute action correctrice
 * passe par d'autres use cases (`RetirerTirageDeCommande`,
 * `ExporterCommande`, `SupprimerOrphelinsExport`).
 */
export interface ControlerCoherenceSessionEntree {
  readonly sessionId: string;
}

export interface PhotoFantome {
  readonly commandeId: string;
  readonly acheteurId: string;
  readonly photoNumero: number;
  /** Tirages de cette commande qui réfèrent à la photo disparue. */
  readonly tirageIds: readonly string[];
}

export interface ExportIncomplet {
  readonly commandeId: string;
  readonly acheteurId: string;
  readonly fichiersManquants: number;
  readonly fichiersAttendus: number;
}

export interface OrphelinExport {
  readonly cheminAbsolu: string;
  readonly sousDossier: string;
  readonly nomFichier: string;
  readonly photoNumero: number;
  readonly exemplaire: number;
  /**
   * Id de l'acheteur dont le slug actuel matche celui du fichier. `null`
   * si aucun acheteur ne matche (l'acheteur a été supprimé, ou son nom
   * a changé sans nettoyage complet).
   */
  readonly acheteurIdConnu: string | null;
}

export interface ControlerCoherenceSessionResultat {
  readonly photosFantomes: readonly PhotoFantome[];
  readonly exportsIncomplets: readonly ExportIncomplet[];
  readonly orphelinsExport: readonly OrphelinExport[];
}

const REGEX_PHOTO_SOURCE = /^(\d+)\.jpe?g$/i;

export class ControlerCoherenceSessionUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly commandeRepository: CommandeRepository,
    private readonly fileLister: FileLister,
  ) {}

  async execute(
    entree: ControlerCoherenceSessionEntree,
  ): Promise<ControlerCoherenceSessionResultat> {
    const session = await this.sessionRepository.findById(entree.sessionId);
    const commandes = await this.commandeRepository.findBySessionId(
      entree.sessionId,
    );

    const numerosSource = await this.scannerNumerosSource(
      session.dossierSource.valeur,
    );
    const fichiersExport = await this.scannerFichiersExport(
      session.dossierExport.valeur,
    );

    // Ensemble des fichiers d'export attendus par les commandes courantes
    // (clé = `{sousDossier}/{nomFichier}`). Sert à la fois à détecter les
    // exports incomplets et les orphelins.
    const fichiersAttendus = new Set<string>();
    for (const commande of commandes) {
      const acheteur = session.acheteurs.find(
        (a) => a.id === commande.acheteurId,
      );
      if (!acheteur) continue;
      for (const cible of commande.nomsFichiersExport(acheteur.nom)) {
        fichiersAttendus.add(joinChemin(cible.sousDossier, cible.nomFichier));
      }
    }

    const photosFantomes: PhotoFantome[] = [];
    const exportsIncomplets: ExportIncomplet[] = [];

    for (const commande of commandes) {
      const acheteur = session.acheteurs.find(
        (a) => a.id === commande.acheteurId,
      );
      if (!acheteur) continue;

      const tiragesParPhoto = new Map<number, string[]>();
      for (const t of commande.tirages) {
        const liste = tiragesParPhoto.get(t.photoNumero) ?? [];
        liste.push(t.id);
        tiragesParPhoto.set(t.photoNumero, liste);
      }

      for (const [photoNumero, tirageIds] of tiragesParPhoto) {
        if (!numerosSource.has(photoNumero)) {
          photosFantomes.push({
            commandeId: commande.id,
            acheteurId: commande.acheteurId,
            photoNumero,
            tirageIds,
          });
        }
      }

      // Exports manquants : on ignore les tirages fantômes (ils seront
      // retirés par l'action section A, pas par ré-export).
      const ciblesExport = commande
        .nomsFichiersExport(acheteur.nom)
        .filter((c) => numerosSource.has(c.photoNumero));
      if (ciblesExport.length === 0) continue;

      let manquants = 0;
      for (const cible of ciblesExport) {
        const fichiers = fichiersExport.get(cible.sousDossier) ?? new Set();
        if (!fichiers.has(cible.nomFichier)) manquants += 1;
      }
      if (manquants > 0) {
        exportsIncomplets.push({
          commandeId: commande.id,
          acheteurId: commande.acheteurId,
          fichiersManquants: manquants,
          fichiersAttendus: ciblesExport.length,
        });
      }
    }

    // Orphelins : fichiers sur disque dans un format valide, parsables
    // comme `{slug}_{photo}_{i}.jpg`, mais pas attendus par les
    // commandes courantes.
    const slugVersAcheteurId = new Map<string, string>();
    for (const a of session.acheteurs) {
      try {
        slugVersAcheteurId.set(slugifierNomAcheteur(a.nom), a.id);
      } catch {
        // nom pathologique, ignorer
      }
    }

    const orphelinsExport: OrphelinExport[] = [];
    for (const [sousDossier, noms] of fichiersExport) {
      for (const nom of noms) {
        const cle = joinChemin(sousDossier, nom);
        if (fichiersAttendus.has(cle)) continue;
        const parsed = parserNomFichierExport(nom);
        if (!parsed) continue; // fichier hors convention, on ne touche pas
        orphelinsExport.push({
          cheminAbsolu: joinChemin(
            session.dossierExport.valeur,
            sousDossier,
            nom,
          ),
          sousDossier,
          nomFichier: nom,
          photoNumero: parsed.photoNumero,
          exemplaire: parsed.exemplaire,
          acheteurIdConnu: slugVersAcheteurId.get(parsed.slug) ?? null,
        });
      }
    }
    orphelinsExport.sort((a, b) => {
      if (a.sousDossier !== b.sousDossier) {
        return a.sousDossier.localeCompare(b.sousDossier);
      }
      return a.nomFichier.localeCompare(b.nomFichier);
    });

    return { photosFantomes, exportsIncomplets, orphelinsExport };
  }

  private async scannerNumerosSource(
    dossierSource: string,
  ): Promise<Set<number>> {
    const fichiers = await this.fileLister.listerFichiers(dossierSource);
    const numeros = new Set<number>();
    for (const nom of fichiers) {
      const m = REGEX_PHOTO_SOURCE.exec(nom);
      if (!m) continue;
      const n = Number.parseInt(m[1], 10);
      if (Number.isInteger(n) && n >= 1) numeros.add(n);
    }
    return numeros;
  }

  /**
   * Pré-scan de tous les sous-dossiers de format du `dossierExport` en
   * UNE passe, puis on indexe par sousDossier → Set<nomFichier>. Évite
   * de re-lister le même dossier pour chaque commande.
   */
  private async scannerFichiersExport(
    dossierExport: string,
  ): Promise<Map<string, Set<string>>> {
    const index = new Map<string, Set<string>>();
    for (const format of Format.TOUS) {
      const sousDossier = format.toDossierName();
      const dossier = joinChemin(dossierExport, sousDossier);
      const fichiers = await this.fileLister.listerFichiers(dossier);
      index.set(sousDossier, new Set(fichiers));
    }
    return index;
  }
}
