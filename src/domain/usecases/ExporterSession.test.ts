import { describe, it, expect } from "vitest";
import { Commande } from "../entities/Commande";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "../ports/CommandeRepository";
import { Format } from "../value-objects/Format";
import type {
  ExporterCommandeEntree,
  ExporterCommandeResultat,
  ExporterCommandeUseCase,
} from "./ExporterCommande";
import { ExporterSessionUseCase } from "./ExporterSession";

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
  async findAll(): Promise<readonly Commande[]> {
    return Array.from(this.map.values());
  }
  async findBySessionId(sessionId: string): Promise<readonly Commande[]> {
    return Array.from(this.map.values()).filter(
      (c) => c.sessionId === sessionId,
    );
  }
  async findByAcheteur(): Promise<Commande | null> {
    return null;
  }
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
  async replaceAll(commandes: readonly Commande[]): Promise<void> {
    this.map.clear();
    commandes.forEach((c) => this.map.set(c.id, c));
  }
}

/**
 * Stub minimal qui simule ExporterCommandeUseCase : pour chaque
 * commandeId, soit on retourne `{ fichiersCrees: N }`, soit on lève
 * l'erreur associée.
 */
class StubExporterCommande {
  readonly resultats = new Map<string, number>();
  readonly echecs = new Map<string, string>();

  async execute(
    entree: ExporterCommandeEntree,
  ): Promise<ExporterCommandeResultat> {
    const messageEchec = this.echecs.get(entree.commandeId);
    if (messageEchec !== undefined) {
      throw new Error(messageEchec);
    }
    return { fichiersCrees: this.resultats.get(entree.commandeId) ?? 0 };
  }
}

function commande(id: string, sessionId: string, acheteurId: string): Commande {
  const c = Commande.creer({ id, sessionId, acheteurId });
  // Un tirage arbitraire pour rendre la commande non vide ; le contenu
  // exact n'est pas observé par ce use case (délégué à ExporterCommande).
  c.ajouterTirage({
    photoNumero: 1,
    format: Format._20x30,
    quantite: 1,
  });
  return c;
}

describe("ExporterSessionUseCase (orchestrateur)", () => {
  it("boucle sur toutes les commandes et agrège le rapport", async () => {
    const sessionId = "sess-1";
    const commandes = [
      commande("cmd-A", sessionId, "ach-A"),
      commande("cmd-B", sessionId, "ach-B"),
      commande("cmd-C", sessionId, "ach-C"),
    ];
    const repo = new InMemoryCommandeRepo(commandes);
    const stub = new StubExporterCommande();
    stub.resultats.set("cmd-A", 3);
    stub.resultats.set("cmd-B", 2);
    stub.resultats.set("cmd-C", 5);
    const useCase = new ExporterSessionUseCase(
      repo,
      stub as unknown as ExporterCommandeUseCase,
    );

    const r = await useCase.execute({ sessionId });

    expect(r.commandesTotales).toBe(3);
    expect(r.commandesReussies).toBe(3);
    expect(r.fichiersCrees).toBe(10);
    expect(r.erreurs).toEqual([]);
  });

  it("continue malgré un échec et rapporte l'erreur précise par commande", async () => {
    const sessionId = "sess-1";
    const commandes = [
      commande("cmd-A", sessionId, "ach-A"),
      commande("cmd-B", sessionId, "ach-B"),
      commande("cmd-C", sessionId, "ach-C"),
    ];
    const repo = new InMemoryCommandeRepo(commandes);
    const stub = new StubExporterCommande();
    stub.resultats.set("cmd-A", 3);
    stub.echecs.set("cmd-B", "source manquante : /src/99.jpg");
    stub.resultats.set("cmd-C", 5);
    const useCase = new ExporterSessionUseCase(
      repo,
      stub as unknown as ExporterCommandeUseCase,
    );

    const r = await useCase.execute({ sessionId });

    expect(r.commandesTotales).toBe(3);
    expect(r.commandesReussies).toBe(2);
    expect(r.fichiersCrees).toBe(8); // 3 de A + 5 de C
    expect(r.erreurs).toHaveLength(1);
    expect(r.erreurs[0]).toEqual({
      commandeId: "cmd-B",
      acheteurId: "ach-B",
      message: "source manquante : /src/99.jpg",
    });
  });

  it("retourne 0/0 sans erreur pour une session sans commande", async () => {
    const repo = new InMemoryCommandeRepo();
    const useCase = new ExporterSessionUseCase(
      repo,
      new StubExporterCommande() as unknown as ExporterCommandeUseCase,
    );

    const r = await useCase.execute({ sessionId: "sess-vide" });

    expect(r).toEqual({
      commandesTotales: 0,
      commandesReussies: 0,
      fichiersCrees: 0,
      erreurs: [],
    });
  });

  it("continue même si plusieurs commandes consécutives échouent", async () => {
    const sessionId = "sess-1";
    const commandes = [
      commande("cmd-A", sessionId, "ach-A"),
      commande("cmd-B", sessionId, "ach-B"),
      commande("cmd-C", sessionId, "ach-C"),
    ];
    const repo = new InMemoryCommandeRepo(commandes);
    const stub = new StubExporterCommande();
    stub.echecs.set("cmd-A", "erreur A");
    stub.echecs.set("cmd-B", "erreur B");
    stub.resultats.set("cmd-C", 4);
    const useCase = new ExporterSessionUseCase(
      repo,
      stub as unknown as ExporterCommandeUseCase,
    );

    const r = await useCase.execute({ sessionId });

    expect(r.commandesReussies).toBe(1);
    expect(r.erreurs.map((e) => e.commandeId)).toEqual(["cmd-A", "cmd-B"]);
    expect(r.fichiersCrees).toBe(4);
  });
});
