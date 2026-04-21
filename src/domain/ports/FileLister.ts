/**
 * Port du domaine — liste les noms de fichiers (hors sous-dossiers) d'un
 * répertoire donné. Utilisé pour identifier les orphelins à nettoyer lors
 * d'un ré-export : on compare ce qui est sur disque à ce que la commande
 * attend.
 *
 * Sémantique : retourne un tableau vide si le dossier n'existe pas (cas
 * normal — la session n'a encore jamais rien exporté, ou ce format n'a
 * jamais été utilisé). Ne lève que pour une vraie erreur d'accès.
 */
export interface FileLister {
  listerFichiers(dossier: string): Promise<readonly string[]>;
}
