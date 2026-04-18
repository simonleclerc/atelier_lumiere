import { describe, it, expect } from "vitest";
import { Session } from "../entities/Session";
import {
  SessionIntrouvable,
  type SessionRepository,
} from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { ModifierInfosSessionUseCase } from "./ModifierInfosSession";

function grille(): GrilleTarifaire {
  return new GrilleTarifaire([
    [Format._15x23, new Montant(800)],
    [Format._20x30, new Montant(1200)],
    [Format._30x45, new Montant(1800)],
    [Format.NUMERIQUE, new Montant(500)],
  ]);
}

function sessionDemo(): Session {
  return Session.creer({
    commanditaire: "Théâtre",
    referent: "Claude",
    date: new Date("2026-04-01"),
    type: "Spectacle",
    dossierSource: new CheminDossier("/a"),
    dossierExport: new CheminDossier("/b"),
    grilleTarifaire: grille(),
    photoNumeros: [1, 2],
  });
}

class InMemorySessionRepo implements SessionRepository {
  readonly map = new Map<string, Session>();
  constructor(initial: Session[] = []) {
    initial.forEach((s) => this.map.set(s.id, s));
  }
  async save(s: Session): Promise<void> {
    this.map.set(s.id, s);
  }
  async findById(id: string): Promise<Session> {
    const s = this.map.get(id);
    if (!s) throw new SessionIntrouvable(id);
    return s;
  }
  async findAll(): Promise<readonly Session[]> {
    return Array.from(this.map.values());
  }
}

describe("ModifierInfosSessionUseCase", () => {
  it("charge, modifie et sauve", async () => {
    const session = sessionDemo();
    const repo = new InMemorySessionRepo([session]);
    const useCase = new ModifierInfosSessionUseCase(repo);

    await useCase.execute({
      sessionId: session.id,
      commanditaire: "Nouveau",
      referent: "Nouveau Contact",
      date: new Date("2026-05-01"),
      type: "Studio",
      dossierSource: "/new/src",
      dossierExport: "/new/export",
    });

    const rechargee = await repo.findById(session.id);
    expect(rechargee.commanditaire).toBe("Nouveau");
    expect(rechargee.type).toBe("Studio");
    expect(rechargee.dossierSource.valeur).toBe("/new/src");
  });

  it("remonte l'invariant métier si les infos cassent une règle", async () => {
    const session = sessionDemo();
    const repo = new InMemorySessionRepo([session]);
    const useCase = new ModifierInfosSessionUseCase(repo);

    await expect(
      useCase.execute({
        sessionId: session.id,
        commanditaire: "  ",
        referent: "Y",
        date: new Date("2026-05-01"),
        type: "Studio",
        dossierSource: "/a",
        dossierExport: "/b",
      }),
    ).rejects.toThrow(/commanditaire/i);
  });

  it("remonte SessionIntrouvable si l'id est inconnu", async () => {
    const useCase = new ModifierInfosSessionUseCase(new InMemorySessionRepo());
    await expect(
      useCase.execute({
        sessionId: "inconnu",
        commanditaire: "X",
        referent: "Y",
        date: new Date(),
        type: "Studio",
        dossierSource: "/a",
        dossierExport: "/b",
      }),
    ).rejects.toBeInstanceOf(SessionIntrouvable);
  });
});
