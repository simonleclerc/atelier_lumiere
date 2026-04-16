/**
 * Value Object — encapsule un chemin absolu de dossier sur le disque.
 *
 * Pourquoi pas juste `string` ? Pour éviter la "primitive obsession" (Fowler) :
 * tant qu'un chemin est un `string` nu, rien n'empêche de passer un email ou
 * un ID à la place. Le VO rend l'intention visible dans les signatures et
 * porte la validation (invariants) une bonne fois pour toutes.
 *
 * Validation : chemin non vide, absolu. On accepte POSIX (`/...`) et Windows
 * (`C:\...` ou `C:/...`) parce que l'app cible Mac + Windows.
 */
export class CheminDossier {
  readonly valeur: string;

  constructor(valeur: string) {
    const trim = valeur.trim();
    if (!trim) {
      throw new Error("CheminDossier: chemin vide refusé.");
    }
    const estPosix = trim.startsWith("/");
    const estWindows = /^[A-Za-z]:[\\/]/.test(trim);
    if (!estPosix && !estWindows) {
      throw new Error(
        `CheminDossier: chemin relatif refusé ("${trim}"). Utiliser un chemin absolu.`,
      );
    }
    this.valeur = trim;
  }

  egale(autre: CheminDossier): boolean {
    return this.valeur === autre.valeur;
  }

  toString(): string {
    return this.valeur;
  }
}
