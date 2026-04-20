import { describe, it, expect } from "vitest";
import { Commande } from "../entities/Commande";
import { Session } from "../entities/Session";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "../ports/CommandeRepository";
import type { SauvegardeFichierIO } from "../ports/SauvegardeFichierIO";
import {
  SessionIntrouvable,
  type SessionRepository,
} from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { ExporterSauvegardeUseCase } from "./ExporterSauvegarde";
import { ImporterSauvegardeUseCase } from "./ImporterSauvegarde";
import { SauvegardeInvalide } from "./SauvegardeFormat";

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

class FakeFichierIO implements SauvegardeFichierIO {
  readonly ecritures = new Map<string, string>();
  async lire(chemin: string): Promise<string> {
    const contenu = this.ecritures.get(chemin);
    if (contenu === undefined) {
      throw new Error(`Fichier inconnu : ${chemin}`);
    }
    return contenu;
  }
  async ecrire(chemin: string, contenu: string): Promise<void> {
    this.ecritures.set(chemin, contenu);
  }
}

function session(): Session {
  return Session.creer({
    commanditaire: "Théâtre du Soleil",
    referent: "Claude Martin",
    date: new Date("2026-04-01"),
    type: "Spectacle",
    dossierSource: new CheminDossier("/src"),
    dossierExport: new CheminDossier("/export"),
    grilleTarifaire: grille(),
    photoNumeros: [1, 2, 145],
  });
}

describe("ImporterSauvegardeUseCase", () => {
  it("round-trip : export puis import restitue les mêmes données", async () => {
    const source = session();
    const acheteur = source.ajouterAcheteur({
      nom: "Martin Dupont",
      email: "martin@example.com",
    });
    const commande = Commande.creer({
      sessionId: source.id,
      acheteurId: acheteur.id,
    });
    commande.ajouterTirage({
      photoNumero: 145,
      format: Format._20x30,
      quantite: 3,
    });

    const repoS = new InMemorySessionRepo([source]);
    const repoC = new InMemoryCommandeRepo([commande]);
    const io = new FakeFichierIO();

    const exporter = new ExporterSauvegardeUseCase(repoS, repoC, io);
    await exporter.execute("/backup.json");

    // On vide tout puis on importe
    const cibleS = new InMemorySessionRepo();
    const cibleC = new InMemoryCommandeRepo();
    const importer = new ImporterSauvegardeUseCase(cibleS, cibleC, io);

    const r = await importer.execute("/backup.json");

    expect(r.nbSessions).toBe(1);
    expect(r.nbCommandes).toBe(1);

    const restituee = (await cibleS.findAll())[0];
    expect(restituee.id).toBe(source.id);
    expect(restituee.commanditaire).toBe("Théâtre du Soleil");
    expect(restituee.acheteurs).toHaveLength(1);
    expect(restituee.acheteurs[0].email?.valeur).toBe("martin@example.com");
    expect(restituee.photos.map((p) => p.numero)).toEqual([1, 2, 145]);

    const cmdRestituee = (await cibleC.findAll())[0];
    expect(cmdRestituee.tirages[0].quantite).toBe(3);
    expect(cmdRestituee.total(restituee.grilleTarifaire).centimes).toBe(3600);
  });

  it("remplace TOUTES les données existantes (restore destructif)", async () => {
    const ancienneSession = session();
    ancienneSession.ajouterAcheteur({ nom: "À effacer" });

    // Export vide (pas de données dans source)
    const io = new FakeFichierIO();
    await new ExporterSauvegardeUseCase(
      new InMemorySessionRepo(),
      new InMemoryCommandeRepo(),
      io,
    ).execute("/vide.json");

    // Target avec données
    const cibleS = new InMemorySessionRepo([ancienneSession]);
    const cibleC = new InMemoryCommandeRepo();
    const importer = new ImporterSauvegardeUseCase(cibleS, cibleC, io);

    await importer.execute("/vide.json");

    expect((await cibleS.findAll())).toHaveLength(0);
  });

  it("rejette un contenu non-JSON", async () => {
    const io = new FakeFichierIO();
    io.ecritures.set("/bad", "pas du tout du json {}}");
    const importer = new ImporterSauvegardeUseCase(
      new InMemorySessionRepo(),
      new InMemoryCommandeRepo(),
      io,
    );
    await expect(importer.execute("/bad")).rejects.toBeInstanceOf(
      SauvegardeInvalide,
    );
  });

  it("rejette un JSON sans marqueur atelier_lumiere", async () => {
    const io = new FakeFichierIO();
    io.ecritures.set(
      "/other.json",
      JSON.stringify({ version: 1, data: "autre app" }),
    );
    const importer = new ImporterSauvegardeUseCase(
      new InMemorySessionRepo(),
      new InMemoryCommandeRepo(),
      io,
    );
    await expect(importer.execute("/other.json")).rejects.toThrow(
      /schéma inattendu/,
    );
  });

  it("rejette une version non supportée", async () => {
    const io = new FakeFichierIO();
    io.ecritures.set(
      "/futur.json",
      JSON.stringify({
        version: 999,
        exportePar: "atelier_lumiere",
        dateExport: new Date().toISOString(),
        sessions: [],
        commandes: [],
      }),
    );
    const importer = new ImporterSauvegardeUseCase(
      new InMemorySessionRepo(),
      new InMemoryCommandeRepo(),
      io,
    );
    await expect(importer.execute("/futur.json")).rejects.toThrow(
      /version 999/,
    );
  });
});
