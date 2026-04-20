import { describe, it, expect } from "vitest";
import {
  AcheteurIntrouvableDansSession,
  NomAcheteurDejaUtiliseDansSession,
  Session,
} from "../entities/Session";
import {
  SessionIntrouvable,
  type SessionRepository,
} from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { ModifierAcheteurUseCase } from "./ModifierAcheteur";

function grille(): GrilleTarifaire {
  return new GrilleTarifaire([
    [Format._15x23, new Montant(800)],
    [Format._20x30, new Montant(1200)],
    [Format._30x45, new Montant(1800)],
    [Format.NUMERIQUE, new Montant(500)],
  ]);
}

function setup() {
  const session = Session.creer({
    commanditaire: "X",
    referent: "Y",
    date: new Date("2026-04-01"),
    type: "Spectacle",
    dossierSource: new CheminDossier("/a"),
    dossierExport: new CheminDossier("/b"),
    grilleTarifaire: grille(),
    photoNumeros: [1],
  });
  const acheteur = session.ajouterAcheteur({ nom: "Martin" });
  return { session, acheteur };
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
  async replaceAll(sessions: readonly Session[]): Promise<void> {
    this.map.clear();
    sessions.forEach((s) => this.map.set(s.id, s));
  }
}

describe("ModifierAcheteurUseCase", () => {
  it("met à jour l'acheteur et persiste la session", async () => {
    const { session, acheteur } = setup();
    const repo = new InMemorySessionRepo([session]);
    const useCase = new ModifierAcheteurUseCase(repo);

    const result = await useCase.execute({
      sessionId: session.id,
      acheteurId: acheteur.id,
      nom: "Martin Dupont",
      email: "martin@x.com",
    });

    expect(result.id).toBe(acheteur.id);
    expect(result.nom).toBe("Martin Dupont");
    const rechargee = await repo.findById(session.id);
    expect(rechargee.acheteurs[0].email?.valeur).toBe("martin@x.com");
  });

  it("remonte AcheteurIntrouvableDansSession si id inconnu", async () => {
    const { session } = setup();
    const repo = new InMemorySessionRepo([session]);
    const useCase = new ModifierAcheteurUseCase(repo);

    await expect(
      useCase.execute({
        sessionId: session.id,
        acheteurId: "inconnu",
        nom: "X",
      }),
    ).rejects.toBeInstanceOf(AcheteurIntrouvableDansSession);
  });

  it("remonte le conflit d'unicité du nom", async () => {
    const { session, acheteur } = setup();
    const autre = session.ajouterAcheteur({ nom: "Alice" });
    const repo = new InMemorySessionRepo([session]);
    const useCase = new ModifierAcheteurUseCase(repo);

    await expect(
      useCase.execute({
        sessionId: session.id,
        acheteurId: autre.id,
        nom: "martin",
      }),
    ).rejects.toBeInstanceOf(NomAcheteurDejaUtiliseDansSession);
    // sanity : l'acheteur original n'a pas bougé
    expect(acheteur.nom).toBe("Martin");
  });
});
