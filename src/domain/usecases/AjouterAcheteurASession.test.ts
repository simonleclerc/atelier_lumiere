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
import { AjouterAcheteurASessionUseCase } from "./AjouterAcheteurASession";

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

describe("AjouterAcheteurASessionUseCase", () => {
  it("ajoute un acheteur et persiste la session", async () => {
    const session = sessionDemo();
    const repo = new InMemorySessionRepository([session]);
    const useCase = new AjouterAcheteurASessionUseCase(repo);

    const acheteur = await useCase.execute({
      sessionId: session.id,
      nom: "Martin Dupont",
      email: "martin@example.com",
    });

    expect(acheteur.nom).toBe("Martin Dupont");
    const rechargee = await repo.findById(session.id);
    expect(rechargee.acheteurs).toHaveLength(1);
    expect(rechargee.acheteurs[0].email?.valeur).toBe("martin@example.com");
  });

  it("propage l'invariant d'unicité de la Session", async () => {
    const session = sessionDemo();
    const repo = new InMemorySessionRepository([session]);
    const useCase = new AjouterAcheteurASessionUseCase(repo);

    await useCase.execute({ sessionId: session.id, nom: "Martin" });
    await expect(
      useCase.execute({ sessionId: session.id, nom: "MARTIN" }),
    ).rejects.toThrow(/déjà inscrit/);
  });

  it("remonte SessionIntrouvable si l'id est inconnu", async () => {
    const useCase = new AjouterAcheteurASessionUseCase(
      new InMemorySessionRepository(),
    );
    await expect(
      useCase.execute({ sessionId: "inconnu", nom: "X" }),
    ).rejects.toBeInstanceOf(SessionIntrouvable);
  });
});
