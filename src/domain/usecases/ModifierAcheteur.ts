import { AcheteurIntrouvableDansSession } from "../entities/Session";
import type { Acheteur } from "../entities/Acheteur";
import { slugifierNomAcheteur } from "../entities/Commande";
import type { CommandeRepository } from "../ports/CommandeRepository";
import type { FileRenamer } from "../ports/FileRenamer";
import type { SessionRepository } from "../ports/SessionRepository";
import { joinChemin } from "./ExporterCommande";

/**
 * Use case — édite un acheteur dans sa session et déplace les fichiers
 * exportés si l'identité de l'acheteur (nom ou email) change. La
 * validation d'unicité du nom est déléguée à `Session.modifierAcheteur`
 * (invariant d'agrégat).
 *
 * Deux cas déclenchent un renommage :
 *  - Le slug change (renommer `nom` → slug différent) : les fichiers
 *    papier ET numériques sont renommés.
 *  - L'email change sans changer le nom : les fichiers numériques
 *    migrent vers le nouveau sous-dossier `Numerique/{email}/`.
 *
 * Best-effort : fichier manquant = skip silencieux (commande jamais
 * exportée, fichier déplacé manuellement, etc.).
 */
export interface ModifierAcheteurEntree {
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly nom: string;
  readonly email?: string;
  readonly telephone?: string;
}

export interface ModifierAcheteurSortie {
  readonly acheteur: Acheteur;
  readonly fichiersRenommes: number;
}

export class ModifierAcheteurUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly commandeRepository: CommandeRepository,
    private readonly fileRenamer: FileRenamer,
  ) {}

  async execute(
    entree: ModifierAcheteurEntree,
  ): Promise<ModifierAcheteurSortie> {
    const session = await this.sessionRepository.findById(entree.sessionId);
    const acheteurAvant = session.acheteurs.find(
      (a) => a.id === entree.acheteurId,
    );
    if (!acheteurAvant) {
      throw new AcheteurIntrouvableDansSession(entree.acheteurId);
    }
    const ancienNom = acheteurAvant.nom;
    const ancienEmail = acheteurAvant.email?.valeur;

    const acheteur = session.modifierAcheteur(entree.acheteurId, {
      nom: entree.nom,
      email: entree.email,
      telephone: entree.telephone,
    });
    await this.sessionRepository.save(session);

    const fichiersRenommes = await this.renommerExportsSiIdentiteChange(
      { nom: ancienNom, email: ancienEmail },
      { nom: acheteur.nom, email: acheteur.email?.valeur },
      entree.sessionId,
      entree.acheteurId,
      session.dossierExport.valeur,
    );

    return { acheteur, fichiersRenommes };
  }

  /**
   * Déplace les fichiers d'export si le nom ou l'email a changé. Compare
   * les chemins que produirait `Commande.nomsFichiersExport` pour l'
   * ancienne et la nouvelle identité, et renomme paire par paire les
   * fichiers dont le chemin a réellement bougé.
   */
  private async renommerExportsSiIdentiteChange(
    ancien: { nom: string; email: string | undefined },
    nouveau: { nom: string; email: string | undefined },
    sessionId: string,
    acheteurId: string,
    dossierExport: string,
  ): Promise<number> {
    const slugIdentique =
      slugifierNomAcheteur(ancien.nom) === slugifierNomAcheteur(nouveau.nom);
    const emailIdentique = (ancien.email ?? "") === (nouveau.email ?? "");
    if (slugIdentique && emailIdentique) return 0;

    const commande = await this.commandeRepository.findByAcheteur(
      sessionId,
      acheteurId,
    );
    if (!commande) return 0;

    // Si l'email était absent avant, il n'y avait pas de fichier
    // numérique (nomsFichiersExport aurait levé). On peut donc produire
    // la liste ancienne sans email sans risque : elle omettra les
    // numériques, lesquels seront simplement exportés au prochain
    // export.
    let anciens: ReadonlyArray<{
      sousDossier: string;
      nomFichier: string;
      photoNumero: number;
    }>;
    try {
      anciens = commande.nomsFichiersExport(ancien);
    } catch {
      anciens = [];
    }
    let nouveaux: ReadonlyArray<{
      sousDossier: string;
      nomFichier: string;
      photoNumero: number;
    }>;
    try {
      nouveaux = commande.nomsFichiersExport(nouveau);
    } catch {
      nouveaux = [];
    }
    if (anciens.length === 0 || nouveaux.length !== anciens.length) return 0;

    let renommes = 0;
    for (let i = 0; i < anciens.length; i += 1) {
      const src = joinChemin(
        dossierExport,
        anciens[i].sousDossier,
        anciens[i].nomFichier,
      );
      const dst = joinChemin(
        dossierExport,
        nouveaux[i].sousDossier,
        nouveaux[i].nomFichier,
      );
      if (src === dst) continue;
      const ok = await this.fileRenamer.renommerSiExiste(src, dst);
      if (ok) renommes += 1;
    }
    return renommes;
  }
}
