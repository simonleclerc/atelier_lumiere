import { describe, it, expect } from "vitest";
import { Session } from "../entities/Session";
import type { FileSystemScanner } from "../ports/FileSystemScanner";
import type { GrilleTarifaireParDefautProvider } from "../ports/GrilleTarifaireParDefautProvider";
import type { SessionRepository } from "../ports/SessionRepository";
import type { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { CreerSessionUseCase } from "./CreerSession";

/**
 * Démonstration pédagogique : ce use case se teste SANS Tauri, SANS filesystem,
 * SANS React. Les ports sont remplacés par des doubles in-memory construits
 * ici même. C'est la raison d'être de la Clean Architecture — un domaine
 * testable en totale isolation.
 */
class InMemorySessionRepository implements SessionRepository {
  readonly saved: Session[] = [];
  async save(session: Session): Promise<void> {
    this.saved.push(session);
  }
  async findById(): Promise<Session> {
    throw new Error("non utilisé dans ce test");
  }
  async findAll(): Promise<readonly Session[]> {
    return this.saved;
  }
  async delete(id: string): Promise<void> {
    const i = this.saved.findIndex((s) => s.id === id);
    if (i !== -1) this.saved.splice(i, 1);
  }
  async replaceAll(sessions: readonly Session[]): Promise<void> {
    this.saved.length = 0;
    this.saved.push(...sessions);
  }
}

class FakeScanner implements FileSystemScanner {
  constructor(private readonly numeros: readonly number[]) {}
  async scanPhotos(_: CheminDossier): Promise<readonly number[]> {
    return this.numeros;
  }
}

class FakeGrilleProvider implements GrilleTarifaireParDefautProvider {
  async charger(): Promise<GrilleTarifaire> {
    return new GrilleTarifaire([
      [Format._15x23, new Montant(800)],
      [Format._20x30, new Montant(1200)],
      [Format._30x45, new Montant(1800)],
      [Format.NUMERIQUE, new Montant(500)],
    ]);
  }
}

describe("CreerSessionUseCase", () => {
  it("orchestre scan + grille + création + persistance", async () => {
    const repo = new InMemorySessionRepository();
    const scanner = new FakeScanner([1, 2, 3, 4, 5]);
    const useCase = new CreerSessionUseCase(
      repo,
      scanner,
      new FakeGrilleProvider(),
    );

    const session = await useCase.execute({
      commanditaire: "Compagnie X",
      referent: "Alex",
      date: new Date("2026-04-01"),
      type: "Studio",
      dossierSource: "/Users/copain/source",
      dossierExport: "/Users/copain/export",
    });

    expect(session.nombrePhotos()).toBe(5);
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].id).toBe(session.id);
    expect(session.grilleTarifaire.prixPour(Format._20x30).centimes).toBe(1200);
  });

  it("laisse l'invariant remonter quand le type est invalide", async () => {
    const useCase = new CreerSessionUseCase(
      new InMemorySessionRepository(),
      new FakeScanner([]),
      new FakeGrilleProvider(),
    );
    await expect(
      useCase.execute({
        commanditaire: "X",
        referent: "Y",
        date: new Date(),
        type: "Concert",
        dossierSource: "/a",
        dossierExport: "/b",
      }),
    ).rejects.toThrow(/TypeSession inconnu/);
  });
});
