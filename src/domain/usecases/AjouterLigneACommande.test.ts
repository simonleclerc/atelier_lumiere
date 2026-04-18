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
  AjouterLigneACommandeUseCase,
  PhotoIntrouvableDansSession,
} from "./AjouterLigneACommande";

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
    photoNumeros: [1, 2, 3],
  });
  const acheteur = session.ajouterAcheteur({ nom: "Martin" });
  const commande = Commande.creer({
    sessionId: session.id,
    acheteurId: acheteur.id,
  });
  return { session, commande };
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
}

describe("AjouterLigneACommandeUseCase", () => {
  it("ajoute la ligne avec le montant snapshot extrait de la grille session", async () => {
    const { session, commande } = setup();
    const sRepo = new InMemorySessionRepo([session]);
    const cRepo = new InMemoryCommandeRepo([commande]);
    const useCase = new AjouterLigneACommandeUseCase(cRepo, sRepo);

    const ligne = await useCase.execute({
      commandeId: commande.id,
      photoNumero: 2,
      format: "20x30",
      quantite: 3,
    });

    expect(ligne.montantUnitaire.centimes).toBe(1200);
    expect(ligne.total().centimes).toBe(3600);
    const rechargee = await cRepo.findById(commande.id);
    expect(rechargee.lignes).toHaveLength(1);
    expect(rechargee.total().centimes).toBe(3600);
  });

  it("fige le prix à la création même si la grille change plus tard (snapshot)", async () => {
    const { session, commande } = setup();
    const sRepo = new InMemorySessionRepo([session]);
    const cRepo = new InMemoryCommandeRepo([commande]);
    const useCase = new AjouterLigneACommandeUseCase(cRepo, sRepo);

    await useCase.execute({
      commandeId: commande.id,
      photoNumero: 1,
      format: "20x30",
      quantite: 1,
    });

    // Le copain ajuste le prix de la session après la création de la ligne
    session.modifierPrix(Format._20x30, new Montant(9999));
    await sRepo.save(session);

    const rechargee = await cRepo.findById(commande.id);
    expect(rechargee.lignes[0].montantUnitaire.centimes).toBe(1200);
  });

  it("rejette une photo absente de la session", async () => {
    const { session, commande } = setup();
    const sRepo = new InMemorySessionRepo([session]);
    const cRepo = new InMemoryCommandeRepo([commande]);
    const useCase = new AjouterLigneACommandeUseCase(cRepo, sRepo);

    await expect(
      useCase.execute({
        commandeId: commande.id,
        photoNumero: 999,
        format: "20x30",
        quantite: 1,
      }),
    ).rejects.toBeInstanceOf(PhotoIntrouvableDansSession);
  });

  it("propage un format inconnu", async () => {
    const { session, commande } = setup();
    const sRepo = new InMemorySessionRepo([session]);
    const cRepo = new InMemoryCommandeRepo([commande]);
    const useCase = new AjouterLigneACommandeUseCase(cRepo, sRepo);

    await expect(
      useCase.execute({
        commandeId: commande.id,
        photoNumero: 1,
        format: "18x24",
        quantite: 1,
      }),
    ).rejects.toThrow(/Format inconnu/);
  });
});
