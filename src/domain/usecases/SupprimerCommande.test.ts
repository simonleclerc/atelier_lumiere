import { describe, it, expect } from "vitest";
import { Commande } from "../entities/Commande";
import { Session, SessionArchiveeNonModifiable } from "../entities/Session";
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
import { SupprimerCommandeUseCase } from "./SupprimerCommande";

function grille(): GrilleTarifaire {
  return new GrilleTarifaire([
    [Format._15x23, new Montant(800)],
    [Format._20x30, new Montant(1200)],
    [Format._30x45, new Montant(1800)],
    [Format.NUMERIQUE, new Montant(500)],
  ]);
}

function sessionDemo(id: string = "s"): Session {
  return Session.creer({
    id,
    commanditaire: "X",
    referent: "Y",
    date: new Date("2026-04-01"),
    type: "Spectacle",
    dossierSource: new CheminDossier("/src"),
    dossierExport: new CheminDossier("/exp"),
    grilleTarifaire: grille(),
    photoNumeros: [1],
  });
}

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
  async replaceAll(commandes: readonly Commande[]): Promise<void> {
    this.map.clear();
    commandes.forEach((c) => this.map.set(c.id, c));
  }
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
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
  async replaceAll(sessions: readonly Session[]): Promise<void> {
    this.map.clear();
    sessions.forEach((s) => this.map.set(s.id, s));
  }
}

describe("SupprimerCommandeUseCase", () => {
  it("retire la commande du repo (avec tous ses tirages)", async () => {
    const session = sessionDemo();
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId: "a",
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 2,
    });
    const cRepo = new InMemoryCommandeRepo([commande]);
    const sRepo = new InMemorySessionRepo([session]);
    const useCase = new SupprimerCommandeUseCase(cRepo, sRepo);

    await useCase.execute(commande.id);

    expect(cRepo.map.has(commande.id)).toBe(false);
  });

  it("est idempotent sur un id inconnu (ne lève pas)", async () => {
    const cRepo = new InMemoryCommandeRepo();
    const sRepo = new InMemorySessionRepo();
    const useCase = new SupprimerCommandeUseCase(cRepo, sRepo);
    await expect(useCase.execute("inconnu")).resolves.toBeUndefined();
  });

  it("refuse de supprimer si la session est archivée", async () => {
    const session = sessionDemo();
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId: "a",
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 1,
    });
    session.archiver();
    const useCase = new SupprimerCommandeUseCase(
      new InMemoryCommandeRepo([commande]),
      new InMemorySessionRepo([session]),
    );

    await expect(useCase.execute(commande.id)).rejects.toBeInstanceOf(
      SessionArchiveeNonModifiable,
    );
  });
});
