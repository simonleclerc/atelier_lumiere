import { describe, it, expect } from "vitest";
import { Commande } from "../entities/Commande";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "../ports/CommandeRepository";
import { Format } from "../value-objects/Format";
import { SupprimerCommandeUseCase } from "./SupprimerCommande";

class InMemoryCommandeRepo implements CommandeRepository {
  readonly map = new Map<string, Commande>();
  constructor(initial: Commande[] = []) {
    initial.forEach((c) => this.map.set(c.id, c));
  }
  async save(c: Commande): Promise<void> {
    this.map.set(c.id, c);
  }
  async findById(id: string): Promise<Commande> {
    const c = this.map.get(id);
    if (!c) throw new CommandeIntrouvable(id);
    return c;
  }
  async findBySessionId(sessionId: string): Promise<readonly Commande[]> {
    return Array.from(this.map.values()).filter(
      (c) => c.sessionId === sessionId,
    );
  }
  async findByAcheteur(
    sessionId: string,
    acheteurId: string,
  ): Promise<Commande | null> {
    return (
      Array.from(this.map.values()).find(
        (c) => c.sessionId === sessionId && c.acheteurId === acheteurId,
      ) ?? null
    );
  }
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
}

describe("SupprimerCommandeUseCase", () => {
  it("retire la commande du repo (avec tous ses tirages)", async () => {
    const commande = Commande.creer({ sessionId: "s", acheteurId: "a" });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 2,
    });
    const repo = new InMemoryCommandeRepo([commande]);
    const useCase = new SupprimerCommandeUseCase(repo);

    await useCase.execute(commande.id);

    expect(repo.map.has(commande.id)).toBe(false);
  });

  it("est idempotent sur un id inconnu (ne lève pas)", async () => {
    const repo = new InMemoryCommandeRepo();
    const useCase = new SupprimerCommandeUseCase(repo);
    await expect(useCase.execute("inconnu")).resolves.toBeUndefined();
  });
});
