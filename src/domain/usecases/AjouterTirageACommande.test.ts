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
import { AjouterTirageACommandeUseCase } from "./AjouterTirageACommande";
import {
  AcheteurNAppartientPasASession,
  PhotoIntrouvableDansSession,
} from "./erreurs-cross-aggregate";

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
    photoNumeros: [1, 2, 3, 145],
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

describe("AjouterTirageACommandeUseCase (upsert cross-aggregate)", () => {
  it("crée la commande au premier ajout puis réutilise au second (upsert)", async () => {
    const { session, acheteurId } = setup();
    const sRepo = new InMemorySessionRepo([session]);
    const cRepo = new InMemoryCommandeRepo();
    const useCase = new AjouterTirageACommandeUseCase(sRepo, cRepo);

    const r1 = await useCase.execute({
      sessionId: session.id,
      acheteurId,
      photoNumero: 1,
      format: "20x30",
      quantite: 2,
    });
    expect(r1.commandeCreee).toBe(true);
    expect(r1.commande.tirages).toHaveLength(1);

    const r2 = await useCase.execute({
      sessionId: session.id,
      acheteurId,
      photoNumero: 2,
      format: "15x23",
      quantite: 1,
    });
    expect(r2.commandeCreee).toBe(false);
    expect(r2.commande.id).toBe(r1.commande.id);
    expect(r2.commande.tirages).toHaveLength(2);
    expect(cRepo.map.size).toBe(1);
  });

  it("consolide (incrémente qté) si on réajoute le même (photo, format)", async () => {
    const { session, acheteurId } = setup();
    const sRepo = new InMemorySessionRepo([session]);
    const cRepo = new InMemoryCommandeRepo();
    const useCase = new AjouterTirageACommandeUseCase(sRepo, cRepo);

    await useCase.execute({
      sessionId: session.id,
      acheteurId,
      photoNumero: 145,
      format: "20x30",
      quantite: 1,
    });
    const r = await useCase.execute({
      sessionId: session.id,
      acheteurId,
      photoNumero: 145,
      format: "20x30",
      quantite: 2,
    });
    expect(r.commande.tirages).toHaveLength(1);
    expect(r.commande.tirages[0].quantite).toBe(3);
  });

  it("le total reflète la grille live (pas de snapshot figé)", async () => {
    const { session, acheteurId } = setup();
    const sRepo = new InMemorySessionRepo([session]);
    const cRepo = new InMemoryCommandeRepo();
    const useCase = new AjouterTirageACommandeUseCase(sRepo, cRepo);

    await useCase.execute({
      sessionId: session.id,
      acheteurId,
      photoNumero: 1,
      format: "20x30",
      quantite: 2,
    });
    const avant = (await cRepo.findByAcheteur(session.id, acheteurId))!;
    expect(avant.total(session.grilleTarifaire).centimes).toBe(2400);

    // Le copain ajuste le prix après coup — la commande suit.
    session.modifierPrix(Format._20x30, new Montant(2000));
    const apres = (await cRepo.findByAcheteur(session.id, acheteurId))!;
    expect(apres.total(session.grilleTarifaire).centimes).toBe(4000);
  });

  it("rejette si l'acheteur n'appartient pas à la session", async () => {
    const { session } = setup();
    const sRepo = new InMemorySessionRepo([session]);
    const useCase = new AjouterTirageACommandeUseCase(
      sRepo,
      new InMemoryCommandeRepo(),
    );
    await expect(
      useCase.execute({
        sessionId: session.id,
        acheteurId: "ach-inconnu",
        photoNumero: 1,
        format: "20x30",
        quantite: 1,
      }),
    ).rejects.toBeInstanceOf(AcheteurNAppartientPasASession);
  });

  it("rejette une photo absente de la session", async () => {
    const { session, acheteurId } = setup();
    const sRepo = new InMemorySessionRepo([session]);
    const useCase = new AjouterTirageACommandeUseCase(
      sRepo,
      new InMemoryCommandeRepo(),
    );
    await expect(
      useCase.execute({
        sessionId: session.id,
        acheteurId,
        photoNumero: 999,
        format: "20x30",
        quantite: 1,
      }),
    ).rejects.toBeInstanceOf(PhotoIntrouvableDansSession);
  });
});
