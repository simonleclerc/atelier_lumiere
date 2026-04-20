/**
 * Erreurs métier qui traversent plusieurs agrégats — levées par des use
 * cases qui orchestrent Session + Commande. Regroupées ici pour éviter
 * qu'un use case importe depuis un autre (couplage mou).
 */

export class AcheteurNAppartientPasASession extends Error {
  constructor(acheteurId: string, sessionId: string) {
    super(
      `L'acheteur "${acheteurId}" n'est pas inscrit sur la session "${sessionId}".`,
    );
    this.name = "AcheteurNAppartientPasASession";
  }
}

export class PhotoIntrouvableDansSession extends Error {
  constructor(photoNumero: number, sessionId: string) {
    super(
      `Photo n°${photoNumero} introuvable dans la session "${sessionId}".`,
    );
    this.name = "PhotoIntrouvableDansSession";
  }
}
