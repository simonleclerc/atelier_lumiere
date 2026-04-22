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
import { ModifierPrixSessionUseCase } from "./ModifierPrixSession";

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
    photoNumeros: [1],
  });
}

class InMemorySessionRepository implements SessionRepository {
  readonly sessions = new Map<string, Session>();
  constructor(initial: Session[] = []) {
    initial.forEach((s) => this.sessions.set(s.id, s));
  }
  async save(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }
  async findById(id: string): Promise<Session> {
    const s = this.sessions.get(id);
    if (!s) throw new SessionIntrouvable(id);
    return s;
  }
  async findAll(): Promise<readonly Session[]> {
    return Array.from(this.sessions.values());
  }
  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }
  async replaceAll(sessions: readonly Session[]): Promise<void> {
    this.sessions.clear();
    sessions.forEach((s) => this.sessions.set(s.id, s));
  }
}

describe("ModifierPrixSessionUseCase", () => {
  it("modifie le prix d'un format et persiste", async () => {
    const session = sessionDemo();
    const repo = new InMemorySessionRepository([session]);
    const useCase = new ModifierPrixSessionUseCase(repo);

    await useCase.execute({
      sessionId: session.id,
      format: "20x30",
      centimes: 1500,
    });

    const rechargee = await repo.findById(session.id);
    expect(rechargee.grilleTarifaire.prixPour(Format._20x30).centimes).toBe(
      1500,
    );
  });

  it("rejette un format hors catalogue", async () => {
    const session = sessionDemo();
    const repo = new InMemorySessionRepository([session]);
    const useCase = new ModifierPrixSessionUseCase(repo);

    await expect(
      useCase.execute({ sessionId: session.id, format: "18x24", centimes: 900 }),
    ).rejects.toThrow(/Format inconnu/);
  });

  it("rejette un montant négatif (invariant Montant)", async () => {
    const session = sessionDemo();
    const repo = new InMemorySessionRepository([session]);
    const useCase = new ModifierPrixSessionUseCase(repo);

    await expect(
      useCase.execute({ sessionId: session.id, format: "20x30", centimes: -1 }),
    ).rejects.toThrow(/négative/);
  });

  it("remonte SessionIntrouvable si l'id est inconnu", async () => {
    const useCase = new ModifierPrixSessionUseCase(
      new InMemorySessionRepository(),
    );
    await expect(
      useCase.execute({ sessionId: "inconnu", format: "20x30", centimes: 1200 }),
    ).rejects.toBeInstanceOf(SessionIntrouvable);
  });
});
