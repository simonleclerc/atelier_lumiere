import { describe, it, expect } from "vitest";
import { Commande } from "../entities/Commande";
import { Session } from "../entities/Session";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "../ports/CommandeRepository";
import type { FileCopier } from "../ports/FileCopier";
import {
  SessionIntrouvable,
  type SessionRepository,
} from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { AcheteurNAppartientPasASession } from "./erreurs-cross-aggregate";
import { ExporterCommandeUseCase, joinChemin } from "./ExporterCommande";

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
    commanditaire: "Théâtre",
    referent: "Claude",
    date: new Date("2026-04-01"),
    type: "Spectacle",
    dossierSource: new CheminDossier("/Users/copain/src"),
    dossierExport: new CheminDossier("/Users/copain/export"),
    grilleTarifaire: grille(),
    photoNumeros: [1, 145, 300],
  });
  const acheteur = session.ajouterAcheteur({ nom: "Martin Dupont" });
  const commande = Commande.creer({
    sessionId: session.id,
    acheteurId: acheteur.id,
  });
  commande.ajouterTirage({
    photoNumero: 145,
    format: Format._20x30,
    quantite: 3,
  });
  commande.ajouterTirage({
    photoNumero: 1,
    format: Format.NUMERIQUE,
    quantite: 1,
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
  async replaceAll(commandes: readonly Commande[]): Promise<void> {
    this.map.clear();
    commandes.forEach((c) => this.map.set(c.id, c));
  }
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
}

class FakeFileCopier implements FileCopier {
  readonly copies: { source: string; destination: string }[] = [];
  readonly sourcesQuiEchouent = new Set<string>();
  async copier(cheminSource: string, cheminDestination: string): Promise<void> {
    if (this.sourcesQuiEchouent.has(cheminSource)) {
      throw new Error(`source introuvable : ${cheminSource}`);
    }
    this.copies.push({ source: cheminSource, destination: cheminDestination });
  }
}

describe("ExporterCommandeUseCase", () => {
  it("copie les fichiers de tous les tirages avec les bons chemins", async () => {
    const { session, commande } = setup();
    const sRepo = new InMemorySessionRepo([session]);
    const cRepo = new InMemoryCommandeRepo([commande]);
    const copier = new FakeFileCopier();
    const useCase = new ExporterCommandeUseCase(cRepo, sRepo, copier);

    const resultat = await useCase.execute({ commandeId: commande.id });

    expect(resultat.fichiersCrees).toBe(4); // 3 + 1
    expect(copier.copies).toEqual([
      {
        source: "/Users/copain/src/145.jpg",
        destination: "/Users/copain/export/20x30/martin_dupont_145_1.jpg",
      },
      {
        source: "/Users/copain/src/145.jpg",
        destination: "/Users/copain/export/20x30/martin_dupont_145_2.jpg",
      },
      {
        source: "/Users/copain/src/145.jpg",
        destination: "/Users/copain/export/20x30/martin_dupont_145_3.jpg",
      },
      {
        source: "/Users/copain/src/1.jpg",
        destination: "/Users/copain/export/Numerique/martin_dupont_1_1.jpg",
      },
    ]);
  });

  it("ne copie rien pour une commande vide", async () => {
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
    const acheteur = session.ajouterAcheteur({ nom: "Alice" });
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId: acheteur.id,
    });
    const copier = new FakeFileCopier();
    const useCase = new ExporterCommandeUseCase(
      new InMemoryCommandeRepo([commande]),
      new InMemorySessionRepo([session]),
      copier,
    );

    const resultat = await useCase.execute({ commandeId: commande.id });

    expect(resultat.fichiersCrees).toBe(0);
    expect(copier.copies).toHaveLength(0);
  });

  it("passe le statut de la commande à complet après un export réussi", async () => {
    const { session, commande } = setup();
    const cRepo = new InMemoryCommandeRepo([commande]);
    const useCase = new ExporterCommandeUseCase(
      cRepo,
      new InMemorySessionRepo([session]),
      new FakeFileCopier(),
    );

    await useCase.execute({ commandeId: commande.id });

    const rechargee = await cRepo.findById(commande.id);
    expect(rechargee.statut.estComplet()).toBe(true);
  });

  it("passe le statut à erreur avec message si la copie échoue, et re-lance", async () => {
    const { session, commande } = setup();
    const copier = new FakeFileCopier();
    copier.sourcesQuiEchouent.add("/Users/copain/src/145.jpg");
    const cRepo = new InMemoryCommandeRepo([commande]);
    const useCase = new ExporterCommandeUseCase(
      cRepo,
      new InMemorySessionRepo([session]),
      copier,
    );

    await expect(
      useCase.execute({ commandeId: commande.id }),
    ).rejects.toThrow(/source introuvable/);

    const rechargee = await cRepo.findById(commande.id);
    expect(rechargee.statut.estEnErreur()).toBe(true);
    expect(rechargee.statut.messageErreur).toMatch(/source introuvable/);
  });

  it("rejette si l'acheteur a disparu de la session", async () => {
    const { session, commande } = setup();
    const sessionSansAcheteur = Session.creer({
      commanditaire: "X",
      referent: "Y",
      date: new Date("2026-04-01"),
      type: "Spectacle",
      dossierSource: new CheminDossier("/a"),
      dossierExport: new CheminDossier("/b"),
      grilleTarifaire: grille(),
      photoNumeros: [145, 1],
      id: session.id,
    });
    const useCase = new ExporterCommandeUseCase(
      new InMemoryCommandeRepo([commande]),
      new InMemorySessionRepo([sessionSansAcheteur]),
      new FakeFileCopier(),
    );

    await expect(
      useCase.execute({ commandeId: commande.id }),
    ).rejects.toBeInstanceOf(AcheteurNAppartientPasASession);
  });
});

describe("joinChemin", () => {
  it("joint en POSIX par défaut", () => {
    expect(joinChemin("/a", "b", "c.jpg")).toBe("/a/b/c.jpg");
  });

  it("détecte les chemins Windows et garde le séparateur \\", () => {
    expect(joinChemin("C:\\Users\\x", "sub", "file.jpg")).toBe(
      "C:\\Users\\x\\sub\\file.jpg",
    );
  });

  it("normalise les séparateurs en excès", () => {
    expect(joinChemin("/a/", "/b/", "c")).toBe("/a/b/c");
  });
});
