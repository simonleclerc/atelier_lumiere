import { describe, it, expect } from "vitest";
import { Commande } from "../entities/Commande";
import { Session } from "../entities/Session";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "../ports/CommandeRepository";
import {
  SessionIntrouvable,
  type SessionRepository,
} from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import {
  AcheteurNAppartientPasASession,
  PasserCommandeUseCase,
} from "./PasserCommande";

function grille(): GrilleTarifaire {
  return new GrilleTarifaire([
    [Format._15x23, new Montant(800)],
    [Format._20x30, new Montant(1200)],
    [Format._30x45, new Montant(1800)],
    [Format.NUMERIQUE, new Montant(500)],
  ]);
}

function sessionAvecAcheteur(): { session: Session; acheteurId: string } {
  const session = Session.creer({
    commanditaire: "X",
    referent: "Y",
    date: new Date("2026-04-01"),
    type: "Spectacle",
    dossierSource: new CheminDossier("/a"),
    dossierExport: new CheminDossier("/b"),
    grilleTarifaire: grille(),
    photoNumeros: [1, 2, 3],
  });
  const acheteur = session.ajouterAcheteur({ nom: "Martin" });
  return { session, acheteurId: acheteur.id };
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

class InMemoryCommandeRepo implements CommandeRepository {
  readonly map = new Map<string, Commande>();
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
}

describe("PasserCommandeUseCase (cross-aggregate)", () => {
  it("crée une commande vide pour un acheteur de la session", async () => {
    const { session, acheteurId } = sessionAvecAcheteur();
    const sRepo = new InMemorySessionRepo([session]);
    const cRepo = new InMemoryCommandeRepo();
    const useCase = new PasserCommandeUseCase(sRepo, cRepo);

    const commande = await useCase.execute({
      sessionId: session.id,
      acheteurId,
    });

    expect(commande.sessionId).toBe(session.id);
    expect(commande.acheteurId).toBe(acheteurId);
    expect(commande.lignes).toHaveLength(0);
    expect(cRepo.map.get(commande.id)).toBeDefined();
  });

  it("rejette si l'acheteur n'est pas inscrit sur la session", async () => {
    const { session } = sessionAvecAcheteur();
    const sRepo = new InMemorySessionRepo([session]);
    const useCase = new PasserCommandeUseCase(sRepo, new InMemoryCommandeRepo());

    await expect(
      useCase.execute({ sessionId: session.id, acheteurId: "ach-fantôme" }),
    ).rejects.toBeInstanceOf(AcheteurNAppartientPasASession);
  });

  it("remonte SessionIntrouvable si la session n'existe pas", async () => {
    const useCase = new PasserCommandeUseCase(
      new InMemorySessionRepo(),
      new InMemoryCommandeRepo(),
    );
    await expect(
      useCase.execute({ sessionId: "inconnue", acheteurId: "x" }),
    ).rejects.toBeInstanceOf(SessionIntrouvable);
  });
});
