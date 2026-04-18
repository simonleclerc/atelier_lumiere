import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { Commande } from "@/domain/entities/Commande";
import { LigneCommande } from "@/domain/entities/LigneCommande";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "@/domain/ports/CommandeRepository";
import { Format } from "@/domain/value-objects/Format";
import { Montant } from "@/domain/value-objects/Montant";

/**
 * Adapter Tauri — persistance JSON dans `AppData/commandes.json`.
 *
 * Fichier séparé de `sessions.json` parce que Commande est un agrégat
 * racine distinct (cycle de vie indépendant). Règle "un agrégat = une
 * transaction = un fichier".
 */
const FICHIER = "commandes.json";

interface LigneJson {
  readonly id: string;
  readonly photoNumero: number;
  readonly format: string;
  readonly quantite: number;
  readonly centimesUnitaire: number;
}

interface CommandeJson {
  readonly id: string;
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly dateCreation: string;
  readonly lignes: readonly LigneJson[];
}

export class TauriCommandeRepository implements CommandeRepository {
  async save(commande: Commande): Promise<void> {
    const raws = await this.loadRaw();
    const filtered = raws.filter((r) => r.id !== commande.id);
    filtered.push(toJson(commande));
    await this.ensureAppDir();
    await writeTextFile(FICHIER, JSON.stringify(filtered, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  }

  async findById(id: string): Promise<Commande> {
    const raws = await this.loadRaw();
    const trouvee = raws.find((r) => r.id === id);
    if (!trouvee) throw new CommandeIntrouvable(id);
    return fromJson(trouvee);
  }

  async findBySessionId(sessionId: string): Promise<readonly Commande[]> {
    const raws = await this.loadRaw();
    return raws.filter((r) => r.sessionId === sessionId).map(fromJson);
  }

  private async ensureAppDir(): Promise<void> {
    const ok = await exists("", { baseDir: BaseDirectory.AppData });
    if (!ok) {
      await mkdir("", { baseDir: BaseDirectory.AppData, recursive: true });
    }
  }

  private async loadRaw(): Promise<CommandeJson[]> {
    const present = await exists(FICHIER, { baseDir: BaseDirectory.AppData });
    if (!present) return [];
    const content = await readTextFile(FICHIER, {
      baseDir: BaseDirectory.AppData,
    });
    if (!content.trim()) return [];
    return JSON.parse(content) as CommandeJson[];
  }
}

function toJson(commande: Commande): CommandeJson {
  return {
    id: commande.id,
    sessionId: commande.sessionId,
    acheteurId: commande.acheteurId,
    dateCreation: commande.dateCreation.toISOString(),
    lignes: commande.lignes.map((l) => ({
      id: l.id,
      photoNumero: l.photoNumero,
      format: l.format.toDossierName(),
      quantite: l.quantite,
      centimesUnitaire: l.montantUnitaire.centimes,
    })),
  };
}

function fromJson(raw: CommandeJson): Commande {
  return new Commande({
    id: raw.id,
    sessionId: raw.sessionId,
    acheteurId: raw.acheteurId,
    dateCreation: new Date(raw.dateCreation),
    lignes: raw.lignes.map(
      (l) =>
        new LigneCommande({
          id: l.id,
          photoNumero: l.photoNumero,
          format: Format.depuis(l.format),
          quantite: l.quantite,
          montantUnitaire: new Montant(l.centimesUnitaire),
        }),
    ),
  });
}
