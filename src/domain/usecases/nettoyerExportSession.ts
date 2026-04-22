import { estFichierExportDeSlug } from "../entities/Commande";
import type { FileLister } from "../ports/FileLister";
import type { FileRemover } from "../ports/FileRemover";
import { Format } from "../value-objects/Format";
import { joinChemin } from "./ExporterCommande";

/**
 * Helper partagé entre `SupprimerSessionUseCase` (hard delete) et
 * `ArchiverSessionUseCase` (soft purge) — supprime du `dossierExport`
 * tous les fichiers dont le nom matche l'un des slugs passés, puis
 * nettoie les sous-dossiers laissés vides.
 *
 * Pour le format Numérique, descend dans chaque sous-dossier email.
 * Le `dossierExport` racine n'est jamais touché — il appartient à
 * l'utilisateur, pas à la session.
 *
 * Best-effort : si un dossier contient encore des fichiers d'autres
 * sessions ou acheteurs, il reste en place (`supprimerDossierSiVide`
 * retourne false silencieusement).
 */
export async function nettoyerExportSession(params: {
  dossierExport: string;
  slugs: ReadonlySet<string>;
  fileLister: FileLister;
  fileRemover: FileRemover;
}): Promise<{ fichiersSupprimes: number }> {
  const { dossierExport, slugs, fileLister, fileRemover } = params;
  if (slugs.size === 0) return { fichiersSupprimes: 0 };

  let fichiersSupprimes = 0;
  for (const format of Format.TOUS) {
    const dossiersAScanner = await dossiersAScanner_(
      dossierExport,
      format,
      fileLister,
    );
    for (const sousDossier of dossiersAScanner) {
      const dossier = joinChemin(dossierExport, sousDossier);
      const fichiers = await fileLister.listerFichiers(dossier);
      for (const nom of fichiers) {
        let matche = false;
        for (const slug of slugs) {
          if (estFichierExportDeSlug(nom, slug)) {
            matche = true;
            break;
          }
        }
        if (!matche) continue;
        const absolu = joinChemin(dossierExport, sousDossier, nom);
        if (await fileRemover.supprimerSiExiste(absolu)) {
          fichiersSupprimes += 1;
        }
      }
    }
  }

  // Cleanup des sous-dossiers vides : email d'abord (enfants), puis
  // racines de format (parents). Un parent ne peut être vide qu'après
  // ses enfants.
  for (const format of Format.TOUS) {
    const racine = format.toDossierName();
    const dossierRacine = joinChemin(dossierExport, racine);
    if (format.estNumerique()) {
      const sousEmails = await fileLister.listerDossiers(dossierRacine);
      for (const email of sousEmails) {
        await fileRemover.supprimerDossierSiVide(
          joinChemin(dossierRacine, email),
        );
      }
    }
    await fileRemover.supprimerDossierSiVide(dossierRacine);
  }

  return { fichiersSupprimes };
}

async function dossiersAScanner_(
  dossierExport: string,
  format: Format,
  fileLister: FileLister,
): Promise<readonly string[]> {
  const racine = format.toDossierName();
  if (!format.estNumerique()) return [racine];
  const sousEmails = await fileLister.listerDossiers(
    joinChemin(dossierExport, racine),
  );
  return [racine, ...sousEmails.map((email) => `${racine}/${email}`)];
}
