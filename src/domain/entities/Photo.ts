/**
 * Entité fille de l'agrégat Session.
 *
 * Pourquoi "entité" et pas Value Object ? Parce qu'on l'identifie par son
 * numéro (id stable scoped à la session), pas par son contenu. Deux photos
 * portant le numéro 145 dans la même session sont la même photo.
 *
 * Pourquoi "fille" et pas agrégat racine ? Parce qu'elle n'a pas de cycle
 * de vie propre hors de sa Session : on ne crée pas, ne modifie pas, ne
 * supprime pas une photo indépendamment. C'est la règle DDD classique
 * (Vernon) : si l'objet n'a pas d'invariant à défendre seul, il vit dans
 * l'agrégat de sa racine.
 */
export class Photo {
  constructor(readonly numero: number) {
    if (!Number.isInteger(numero) || numero < 1) {
      throw new Error(
        `Photo: numéro entier ≥ 1 attendu (reçu ${numero}).`,
      );
    }
  }

  egale(autre: Photo): boolean {
    return this.numero === autre.numero;
  }
}
