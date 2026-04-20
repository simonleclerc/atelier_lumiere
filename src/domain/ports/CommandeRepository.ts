import type { Commande } from "../entities/Commande";

export class CommandeIntrouvable extends Error {
  constructor(id: string) {
    super(`Commande introuvable pour l'id "${id}".`);
    this.name = "CommandeIntrouvable";
  }
}

/**
 * Port du domaine. Les commandes sont un agrégat racine séparé de Session,
 * donc persistées indépendamment (pas dans le JSON session).
 *
 * `findBySessionId` est une requête métier utile pour l'UI : montrer
 * toutes les commandes liées à une session sans charger toutes les
 * commandes. Méthode spécialisée plutôt que filtre côté appelant —
 * l'adapter peut optimiser (index DB plus tard).
 */
export interface CommandeRepository {
  save(commande: Commande): Promise<void>;
  findById(id: string): Promise<Commande>;
  findBySessionId(sessionId: string): Promise<readonly Commande[]>;
  /**
   * Supprime la commande ; ne lève pas si l'id n'existe pas (idempotent).
   */
  delete(id: string): Promise<void>;
}
