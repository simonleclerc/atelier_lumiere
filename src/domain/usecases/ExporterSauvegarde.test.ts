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
import { VERSION_COURANTE } from "./SauvegardeFormat";

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

describe("ExporterSauvegardeUseCase", () => {
  it("écrit un JSON versionné contenant toutes les sessions et commandes", async () => {
    const session = Session.creer({
      commanditaire: "Théâtre",
      referent: "Claude",
      date: new Date("2026-04-01"),
      type: "Spectacle",
      dossierSource: new CheminDossier("/src"),
      dossierExport: new CheminDossier("/export"),
      grilleTarifaire: grille(),
      photoNumeros: [1, 2],
    });
    const acheteur = session.ajouterAcheteur({ nom: "Martin" });
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId: acheteur.id,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 2,
    });

    const io = new FakeFichierIO();
    const useCase = new ExporterSauvegardeUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      io,
    );

    const resultat = await useCase.execute("/tmp/backup.json");

    expect(resultat.nbSessions).toBe(1);
    expect(resultat.nbCommandes).toBe(1);
    const contenu = io.ecritures.get("/tmp/backup.json")!;
    const parsed = JSON.parse(contenu);
    expect(parsed.version).toBe(VERSION_COURANTE);
    expect(parsed.exportePar).toBe("atelier_lumiere");
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0].commanditaire).toBe("Théâtre");
    expect(parsed.sessions[0].acheteurs[0].nom).toBe("Martin");
    expect(parsed.commandes).toHaveLength(1);
    expect(parsed.commandes[0].tirages[0].quantite).toBe(2);
  });

  it("exporte vide si aucune donnée", async () => {
    const io = new FakeFichierIO();
    const useCase = new ExporterSauvegardeUseCase(
      new InMemorySessionRepo(),
      new InMemoryCommandeRepo(),
      io,
    );

    const r = await useCase.execute("/tmp/vide.json");
    expect(r).toEqual({ nbSessions: 0, nbCommandes: 0 });
    const parsed = JSON.parse(io.ecritures.get("/tmp/vide.json")!);
    expect(parsed.sessions).toEqual([]);
    expect(parsed.commandes).toEqual([]);
  });
});
