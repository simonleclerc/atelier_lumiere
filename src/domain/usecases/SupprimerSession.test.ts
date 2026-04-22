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
import { SupprimerSessionUseCase } from "./SupprimerSession";

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
  readonly suppressions: string[] = [];
  readonly dossiersSupprimes: string[] = [];

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
    this.suppressions.push(chemin);
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
      const set = this.dossiers.get(cle);
      if ((set && set.size > 0) || !set) {
        hasContent = true;
        break;
      }
      // descendant existant mais vide compte aussi comme contenu (sous-dossier)
      hasContent = true;
      break;
    }
    if (!exists || hasContent) return false;
    this.dossiers.delete(chemin);
    this.dossiersSupprimes.push(chemin);
    return true;
  }
}

function sessionAvecMartin(): {
  session: Session;
  acheteurId: string;
} {
  const session = Session.creer({
    commanditaire: "Théâtre",
    referent: "Claude",
    date: new Date("2026-04-01"),
    type: "Spectacle",
    dossierSource: new CheminDossier("/src"),
    dossierExport: new CheminDossier("/exp"),
    grilleTarifaire: grille(),
    photoNumeros: [1, 2, 3],
  });
  const acheteur = session.ajouterAcheteur({
    nom: "Martin",
    email: "martin@example.com",
  });
  return { session, acheteurId: acheteur.id };
}

describe("SupprimerSessionUseCase", () => {
  it("supprime fichiers d'export, commandes et la session elle-même", async () => {
    const { session, acheteurId } = sessionAvecMartin();
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._15x23,
      quantite: 2,
    });
    commande.ajouterTirage({
      photoNumero: 2,
      format: Format.NUMERIQUE,
      quantite: 1,
    });
    const fs = new FakeFileSystem();
    // Fichiers papier
    fs.ajouter("/exp/15x23", "martin1.1.1.jpg");
    fs.ajouter("/exp/15x23", "martin2.1.2.jpg");
    // Fichier numérique dans sous-dossier email
    fs.ajouter("/exp/Numerique/martin@example.com", "martin3.2.1.jpg");

    const sRepo = new InMemorySessionRepo([session]);
    const cRepo = new InMemoryCommandeRepo([commande]);
    const useCase = new SupprimerSessionUseCase(sRepo, cRepo, fs, fs);

    const r = await useCase.execute({ sessionId: session.id });

    expect(r.fichiersSupprimes).toBe(3);
    expect(r.commandesSupprimees).toBe(1);
    expect(sRepo.map.has(session.id)).toBe(false);
    expect(cRepo.map.has(commande.id)).toBe(false);
    expect([...fs.suppressions].sort()).toEqual([
      "/exp/15x23/martin1.1.1.jpg",
      "/exp/15x23/martin2.1.2.jpg",
      "/exp/Numerique/martin@example.com/martin3.2.1.jpg",
    ]);
  });

  it("ne touche pas aux fichiers d'autres acheteurs ou d'autres sessions", async () => {
    const { session, acheteurId } = sessionAvecMartin();
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._15x23,
      quantite: 1,
    });
    const fs = new FakeFileSystem();
    fs.ajouter("/exp/15x23", "martin1.1.1.jpg"); // à supprimer
    fs.ajouter("/exp/15x23", "alice5.1.1.jpg"); // d'un autre acheteur, à garder
    fs.ajouter("/exp/15x23", "bob_dupont1.1.1.jpg"); // idem

    const useCase = new SupprimerSessionUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      fs,
      fs,
    );

    const r = await useCase.execute({ sessionId: session.id });

    expect(r.fichiersSupprimes).toBe(1);
    expect(fs.dossiers.get("/exp/15x23")?.has("alice5.1.1.jpg")).toBe(true);
    expect(fs.dossiers.get("/exp/15x23")?.has("bob_dupont1.1.1.jpg")).toBe(
      true,
    );
  });

  it("supprime aussi les fichiers numériques dans tous les sous-dossiers email d'un acheteur", async () => {
    const { session, acheteurId } = sessionAvecMartin();
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format.NUMERIQUE,
      quantite: 1,
    });
    const fs = new FakeFileSystem();
    // Email actuel
    fs.ajouter("/exp/Numerique/martin@example.com", "martin1.1.1.jpg");
    // Ancien email (avant un changement non nettoyé)
    fs.ajouter("/exp/Numerique/ancien@mail.com", "martin2.1.1.jpg");

    const useCase = new SupprimerSessionUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      fs,
      fs,
    );

    const r = await useCase.execute({ sessionId: session.id });
    expect(r.fichiersSupprimes).toBe(2);
  });

  it("fonctionne pour une session sans acheteur (rien à nettoyer côté disque)", async () => {
    const session = Session.creer({
      commanditaire: "Théâtre",
      referent: "Claude",
      date: new Date("2026-04-01"),
      type: "Spectacle",
      dossierSource: new CheminDossier("/src"),
      dossierExport: new CheminDossier("/exp"),
      grilleTarifaire: grille(),
      photoNumeros: [1],
    });
    const fs = new FakeFileSystem();
    const sRepo = new InMemorySessionRepo([session]);
    const useCase = new SupprimerSessionUseCase(
      sRepo,
      new InMemoryCommandeRepo(),
      fs,
      fs,
    );

    const r = await useCase.execute({ sessionId: session.id });
    expect(r.fichiersSupprimes).toBe(0);
    expect(r.commandesSupprimees).toBe(0);
    expect(sRepo.map.has(session.id)).toBe(false);
  });

  it("propage SessionIntrouvable si l'id est inconnu", async () => {
    const useCase = new SupprimerSessionUseCase(
      new InMemorySessionRepo(),
      new InMemoryCommandeRepo(),
      new FakeFileSystem(),
      new FakeFileSystem(),
    );

    await expect(
      useCase.execute({ sessionId: "inconnu" }),
    ).rejects.toBeInstanceOf(SessionIntrouvable);
  });

  it("supprime les sous-dossiers email vides après nettoyage des fichiers numériques", async () => {
    const { session, acheteurId } = sessionAvecMartin();
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format.NUMERIQUE,
      quantite: 1,
    });
    const fs = new FakeFileSystem();
    fs.ajouter("/exp/Numerique/martin@example.com", "martin1.1.1.jpg");

    const useCase = new SupprimerSessionUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      fs,
      fs,
    );

    await useCase.execute({ sessionId: session.id });

    expect(fs.dossiersSupprimes).toContain(
      "/exp/Numerique/martin@example.com",
    );
    expect(fs.dossiers.has("/exp/Numerique/martin@example.com")).toBe(false);
  });

  it("ne supprime pas un sous-dossier email partagé avec d'autres fichiers", async () => {
    const { session, acheteurId } = sessionAvecMartin();
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format.NUMERIQUE,
      quantite: 1,
    });
    const fs = new FakeFileSystem();
    // Le fichier numérique de Martin et un fichier d'un autre acheteur
    // partageant le MÊME email (cas familles, plusieurs membres) — le
    // sous-dossier ne doit PAS être supprimé tant qu'il reste du contenu.
    fs.ajouter("/exp/Numerique/martin@example.com", "martin1.1.1.jpg");
    fs.ajouter(
      "/exp/Numerique/martin@example.com",
      "autre_acheteur1.5.1.jpg",
    );

    const useCase = new SupprimerSessionUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      fs,
      fs,
    );

    await useCase.execute({ sessionId: session.id });

    expect(fs.dossiersSupprimes).not.toContain(
      "/exp/Numerique/martin@example.com",
    );
    expect(
      fs.dossiers.get("/exp/Numerique/martin@example.com")?.has(
        "autre_acheteur1.5.1.jpg",
      ),
    ).toBe(true);
  });
});
