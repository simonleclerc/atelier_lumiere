import { describe, it, expect } from "vitest";
import { Commande } from "../entities/Commande";
import { Session } from "../entities/Session";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "../ports/CommandeRepository";
import type { FileLister } from "../ports/FileLister";
import type { FileRemover } from "../ports/FileRemover";
import {
  SessionIntrouvable,
  type SessionRepository,
} from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { ArchiverSessionUseCase } from "./ArchiverSession";
import { DesarchiverSessionUseCase } from "./DesarchiverSession";

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

class FakeFileSystem implements FileLister, FileRemover {
  readonly dossiers = new Map<string, Set<string>>();
  ajouter(dossier: string, nomFichier: string): void {
    if (!this.dossiers.has(dossier)) this.dossiers.set(dossier, new Set());
    this.dossiers.get(dossier)!.add(nomFichier);
  }
  async listerFichiers(dossier: string): Promise<readonly string[]> {
    return [...(this.dossiers.get(dossier) ?? new Set())];
  }
  async listerDossiers(dossier: string): Promise<readonly string[]> {
    const prefixe = dossier.endsWith("/") ? dossier : `${dossier}/`;
    const sous = new Set<string>();
    for (const cle of this.dossiers.keys()) {
      if (!cle.startsWith(prefixe)) continue;
      const reste = cle.slice(prefixe.length);
      if (!reste) continue;
      sous.add(reste.split("/")[0]);
    }
    return [...sous];
  }
  async supprimerSiExiste(chemin: string): Promise<boolean> {
    const sep = chemin.includes("\\") ? "\\" : "/";
    const idx = chemin.lastIndexOf(sep);
    const dossier = chemin.slice(0, idx);
    const nom = chemin.slice(idx + 1);
    const set = this.dossiers.get(dossier);
    if (!set?.has(nom)) return false;
    set.delete(nom);
    return true;
  }
  async supprimerDossierSiVide(chemin: string): Promise<boolean> {
    const prefixe = chemin.endsWith("/") ? chemin : `${chemin}/`;
    const direct = this.dossiers.get(chemin);
    let exists = direct !== undefined;
    let hasContent = !!(direct && direct.size > 0);
    for (const cle of this.dossiers.keys()) {
      if (cle === chemin || !cle.startsWith(prefixe)) continue;
      exists = true;
      hasContent = true;
      break;
    }
    if (!exists || hasContent) return false;
    this.dossiers.delete(chemin);
    return true;
  }
}

function setup(): {
  session: Session;
  acheteurId: string;
  commande: Commande;
} {
  const session = Session.creer({
    commanditaire: "X",
    referent: "Y",
    date: new Date("2026-04-01"),
    type: "Spectacle",
    dossierSource: new CheminDossier("/src"),
    dossierExport: new CheminDossier("/exp"),
    grilleTarifaire: grille(),
    photoNumeros: [1, 2],
  });
  const acheteur = session.ajouterAcheteur({
    nom: "Martin",
    email: "martin@example.com",
  });
  const commande = Commande.creer({
    sessionId: session.id,
    acheteurId: acheteur.id,
  });
  commande.ajouterTirage({
    photoNumero: 1,
    format: Format._15x23,
    quantite: 1,
  });
  return { session, acheteurId: acheteur.id, commande };
}

describe("ArchiverSessionUseCase", () => {
  it("nettoie les fichiers d'export, archive la session, conserve les commandes", async () => {
    const { session, commande } = setup();
    const fs = new FakeFileSystem();
    fs.ajouter("/exp/15x23", "martin1.1.1.jpg");
    const sRepo = new InMemorySessionRepo([session]);
    const cRepo = new InMemoryCommandeRepo([commande]);

    const useCase = new ArchiverSessionUseCase(sRepo, cRepo, fs, fs);
    const r = await useCase.execute({ sessionId: session.id });

    expect(r.fichiersSupprimes).toBe(1);
    const rechargee = await sRepo.findById(session.id);
    expect(rechargee.archivee).toBe(true);
    // La commande est conservée
    expect(cRepo.map.has(commande.id)).toBe(true);
    // La session est conservée avec ses acheteurs
    expect(rechargee.acheteurs).toHaveLength(1);
  });

  it("est idempotent sur une session déjà archivée", async () => {
    const { session } = setup();
    session.archiver();
    const sRepo = new InMemorySessionRepo([session]);
    const useCase = new ArchiverSessionUseCase(
      sRepo,
      new InMemoryCommandeRepo(),
      new FakeFileSystem(),
      new FakeFileSystem(),
    );

    const r = await useCase.execute({ sessionId: session.id });
    expect(r.fichiersSupprimes).toBe(0);
    expect((await sRepo.findById(session.id)).archivee).toBe(true);
  });

  it("propage SessionIntrouvable si l'id est inconnu", async () => {
    const useCase = new ArchiverSessionUseCase(
      new InMemorySessionRepo(),
      new InMemoryCommandeRepo(),
      new FakeFileSystem(),
      new FakeFileSystem(),
    );
    await expect(
      useCase.execute({ sessionId: "inconnu" }),
    ).rejects.toBeInstanceOf(SessionIntrouvable);
  });
});

describe("DesarchiverSessionUseCase", () => {
  it("flip le flag archivee", async () => {
    const { session } = setup();
    session.archiver();
    const sRepo = new InMemorySessionRepo([session]);
    const useCase = new DesarchiverSessionUseCase(sRepo);

    await useCase.execute({ sessionId: session.id });
    expect((await sRepo.findById(session.id)).archivee).toBe(false);
  });

  it("est idempotent sur une session non archivée", async () => {
    const { session } = setup();
    const sRepo = new InMemorySessionRepo([session]);
    const useCase = new DesarchiverSessionUseCase(sRepo);

    await useCase.execute({ sessionId: session.id });
    expect((await sRepo.findById(session.id)).archivee).toBe(false);
  });

  it("propage SessionIntrouvable si l'id est inconnu", async () => {
    const useCase = new DesarchiverSessionUseCase(new InMemorySessionRepo());
    await expect(
      useCase.execute({ sessionId: "inconnu" }),
    ).rejects.toBeInstanceOf(SessionIntrouvable);
  });
});
