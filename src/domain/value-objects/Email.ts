/**
 * Value Object — adresse email normalisée (trim + lowercase) et valide.
 *
 * Encore une fois, anti "primitive obsession" (Fowler) : un Email nu en
 * `string` peut être passé à la place d'un nom ou d'un téléphone et le
 * compilo ne dit rien. Ici, la signature `Acheteur.email?: Email` rend
 * l'intention claire et porte la validation une fois pour toutes.
 *
 * Note sur la validation : aucun regex email n'est parfait (cf. RFC 5322),
 * ici on se contente d'un filet basique "il y a un @ et un point après" —
 * suffisant pour attraper les fautes de frappe évidentes. Les vrais faux
 * positifs apparaîtront au moment d'envoyer un mail, pas ici.
 */
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  readonly valeur: string;

  constructor(valeur: string) {
    const normalise = valeur.trim().toLowerCase();
    if (!normalise) {
      throw new Error("Email: valeur vide refusée.");
    }
    if (!REGEX_EMAIL.test(normalise)) {
      throw new Error(`Email invalide : "${normalise}".`);
    }
    this.valeur = normalise;
  }

  egale(autre: Email): boolean {
    return this.valeur === autre.valeur;
  }

  toString(): string {
    return this.valeur;
  }
}
