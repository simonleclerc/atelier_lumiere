import { describe, it, expect } from "vitest";
import { Commande } from "../entities/Commande";
import { Session } from "../entities/Session";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "../ports/CommandeRepository";
import type { FileRemover } from "../ports/FileRemover";
import {
  SessionIntrouvable,
  type SessionRepository,
} from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import {
  CheminHorsDossierExport,
  SupprimerOrphelinsExportUseCase,
} from "./SupprimerOrphelinsExport";

function grille(): GrilleTarifaire {
  return new GrilleTarifaire([
    [Format._15x23, new Montant(800)],
    [Format._20x30, new Montant(1200)],
    [Format._30x45, new Montant(1800)],
    [Format.NUMERIQUE, new Montant(500)],
  ]);
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

class FakeFileRemover implements FileRemover {
  readonly fichiers: Set<string>;
  readonly suppressions: string[] = [];
  constructor(presents: string[] = []) {
    this.fichiers = new Set(presents);
  }
  async supprimerSiExiste(chemin: string): Promise<boolean> {
    if (!this.fichiers.has(chemin)) return false;
    this.fichiers.delete(chemin);
    this.suppressions.push(chemin);
    return true;
  }
}

function sessionBase(): Session {
  return Session.creer({
    commanditaire: "X",
    referent: "Y",
    date: new Date("2026-04-01"),
    type: "Spectacle",
    dossierSource: new CheminDossier("/src"),
    dossierExport: new CheminDossier("/exp"),
    grilleTarifaire: grille(),
    photoNumeros: [1, 2],
  });
}

describe("SupprimerOrphelinsExportUseCase", () => {
  it("supprime les orphelins et retourne le compteur", async () => {
    const session = sessionBase();
    const acheteur = session.ajouterAcheteur({ nom: "Martin" });
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId: acheteur.id,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._15x23,
      quantite: 1,
    });
    const fs = new FakeFileRemover([
      "/exp/15x23/martin1.1.1.jpg", // attendu — ne doit PAS être supprimé
      "/exp/15x23/martin2.2.1.jpg", // orphelin
      "/exp/20x30/alice3.5.1.jpg", // orphelin (ancien acheteur)
    ]);
    const useCase = new SupprimerOrphelinsExportUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      fs,
    );

    const r = await useCase.execute({
      sessionId: session.id,
      cheminsAbsolus: [
        "/exp/15x23/martin2.2.1.jpg",
        "/exp/20x30/alice3.5.1.jpg",
      ],
    });

    expect(r.fichiersSupprimes).toBe(2);
    expect(r.ignoresCarAttendus).toBe(0);
    expect(fs.fichiers.has("/exp/15x23/martin1.1.1.jpg")).toBe(true);
  });

  it("ignore un chemin redevenu attendu entre le rapport et le clic", async () => {
    const session = sessionBase();
    const acheteur = session.ajouterAcheteur({ nom: "Martin" });
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId: acheteur.id,
    });
    // La commande référence maintenant martin1.2.1.jpg — le rapport était stale.
    commande.ajouterTirage({
      photoNumero: 2,
      format: Format._15x23,
      quantite: 1,
    });
    const fs = new FakeFileRemover(["/exp/15x23/martin1.2.1.jpg"]);
    const useCase = new SupprimerOrphelinsExportUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      fs,
    );

    const r = await useCase.execute({
      sessionId: session.id,
      cheminsAbsolus: ["/exp/15x23/martin1.2.1.jpg"],
    });

    expect(r.fichiersSupprimes).toBe(0);
    expect(r.ignoresCarAttendus).toBe(1);
    expect(fs.suppressions).toHaveLength(0);
  });

  it("refuse un chemin hors du dossier export de la session", async () => {
    const session = sessionBase();
    const useCase = new SupprimerOrphelinsExportUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo(),
      new FakeFileRemover(),
    );

    await expect(
      useCase.execute({
        sessionId: session.id,
        cheminsAbsolus: ["/src/1.jpg"], // dossier source !
      }),
    ).rejects.toBeInstanceOf(CheminHorsDossierExport);
  });

  it("retourne 0 sans effet de bord si la liste est vide", async () => {
    const session = sessionBase();
    const fs = new FakeFileRemover(["/exp/15x23/martin1.1.1.jpg"]);
    const useCase = new SupprimerOrphelinsExportUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo(),
      fs,
    );

    const r = await useCase.execute({
      sessionId: session.id,
      cheminsAbsolus: [],
    });

    expect(r.fichiersSupprimes).toBe(0);
    expect(r.ignoresCarAttendus).toBe(0);
    expect(fs.suppressions).toHaveLength(0);
  });

  it("tolère les fichiers déjà disparus du disque (best-effort)", async () => {
    const session = sessionBase();
    const fs = new FakeFileRemover([]); // rien sur disque
    const useCase = new SupprimerOrphelinsExportUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo(),
      fs,
    );

    const r = await useCase.execute({
      sessionId: session.id,
      cheminsAbsolus: ["/exp/15x23/martin1.1.1.jpg"],
    });

    expect(r.fichiersSupprimes).toBe(0);
    expect(r.ignoresCarAttendus).toBe(0);
  });
});
