/**
 * Port du domaine — inspecte le contenu d'un répertoire.
 *
 * `listerFichiers` retourne les NOMS des fichiers (hors sous-dossiers).
 * `listerDossiers` retourne les NOMS des sous-dossiers directs. Les deux
 * renvoient un tableau vide si le dossier n'existe pas (cas normal — la
 * session n'a encore jamais rien exporté, ou ce format n'a jamais été
 * utilisé). Ne lèvent que pour une vraie erreur d'accès.
 *
 * `listerDossiers` sert notamment à parcourir les sous-dossiers email
 * dans `{dossierExport}/Numerique/` pour lister les orphelins (les
 * numériques sont rangés par acheteur, pas à plat).
 */
export interface FileLister {
  listerFichiers(dossier: string): Promise<readonly string[]>;
  listerDossiers(dossier: string): Promise<readonly string[]>;
}
