import { describe, it, expect } from "vitest";
import { Commande, TirageIntrouvable } from "../entities/Commande";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "../ports/CommandeRepository";
import { Format } from "../value-objects/Format";
import { RetirerTirageDeCommandeUseCase } from "./RetirerTirageDeCommande";

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

describe("RetirerTirageDeCommandeUseCase", () => {
  it("retire un tirage parmi plusieurs — la commande est sauvée", async () => {
    const commande = Commande.creer({ sessionId: "s", acheteurId: "a" });
    const t1 = commande.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 1,
    });
    commande.ajouterTirage({
      photoNumero: 2,
      format: Format._20x30,
      quantite: 1,
    });
    const repo = new InMemoryCommandeRepo([commande]);
    const useCase = new RetirerTirageDeCommandeUseCase(repo);

    const { commandeSupprimee } = await useCase.execute({
      commandeId: commande.id,
      tirageId: t1.id,
    });

    expect(commandeSupprimee).toBe(false);
    const rechargee = await repo.findById(commande.id);
    expect(rechargee.tirages).toHaveLength(1);
  });

  it("supprime la commande quand le dernier tirage est retiré", async () => {
    const commande = Commande.creer({ sessionId: "s", acheteurId: "a" });
    const t = commande.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 1,
    });
    const repo = new InMemoryCommandeRepo([commande]);
    const useCase = new RetirerTirageDeCommandeUseCase(repo);

    const { commandeSupprimee } = await useCase.execute({
      commandeId: commande.id,
      tirageId: t.id,
    });

    expect(commandeSupprimee).toBe(true);
    expect(repo.map.has(commande.id)).toBe(false);
  });

  it("remonte TirageIntrouvable si l'id est inconnu", async () => {
    const commande = Commande.creer({ sessionId: "s", acheteurId: "a" });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 1,
    });
    const repo = new InMemoryCommandeRepo([commande]);
    const useCase = new RetirerTirageDeCommandeUseCase(repo);

    await expect(
      useCase.execute({ commandeId: commande.id, tirageId: "inconnu" }),
    ).rejects.toBeInstanceOf(TirageIntrouvable);
  });
});
