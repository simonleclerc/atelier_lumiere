import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  remove,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { Commande } from "@/domain/entities/Commande";
import { Tirage } from "@/domain/entities/Tirage";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "@/domain/ports/CommandeRepository";
import { Format } from "@/domain/value-objects/Format";
import { Montant } from "@/domain/value-objects/Montant";

/**
 * Adapter Tauri — persistance JSON dans `AppData/commandes.json`.
 *
 * Schéma : une commande a ses tirages embarqués sous la clé `tirages`
 * (aligne avec l'ubiquitous language métier — pas `lignes`). Tolérant
 * aux entrées obsolètes : celles qui ne matchent pas le schéma sont
 * ignorées avec un warning console, permettant une migration silencieuse
 * depuis la version d'hier (schéma plat une commande = un tirage).
 */
const FICHIER = "commandes.json";

interface TirageJson {
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
  readonly tirages: readonly TirageJson[];
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

  async findByAcheteur(
    sessionId: string,
    acheteurId: string,
  ): Promise<Commande | null> {
    const raws = await this.loadRaw();
    const trouvee = raws.find(
      (r) => r.sessionId === sessionId && r.acheteurId === acheteurId,
    );
    return trouvee ? fromJson(trouvee) : null;
  }

  async delete(id: string): Promise<void> {
    const raws = await this.loadRaw();
    const filtered = raws.filter((r) => r.id !== id);
    if (filtered.length === raws.length) return;
    await this.ensureAppDir();
    if (filtered.length === 0) {
      await remove(FICHIER, { baseDir: BaseDirectory.AppData });
      return;
    }
    await writeTextFile(FICHIER, JSON.stringify(filtered, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
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
    const parsed = JSON.parse(content) as unknown[];
    const valides: CommandeJson[] = [];
    for (const item of parsed) {
      if (estCommandeJson(item)) {
        valides.push(item);
      } else {
        console.warn(
          "TauriCommandeRepository: entrée ignorée (schéma obsolète ou invalide)",
          item,
        );
      }
    }
    return valides;
  }
}

function estCommandeJson(item: unknown): item is CommandeJson {
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.sessionId !== "string" ||
    typeof o.acheteurId !== "string" ||
    typeof o.dateCreation !== "string" ||
    !Array.isArray(o.tirages)
  ) {
    return false;
  }
  return o.tirages.every(estTirageJson);
}

function estTirageJson(item: unknown): item is TirageJson {
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.photoNumero === "number" &&
    typeof o.format === "string" &&
    typeof o.quantite === "number" &&
    typeof o.centimesUnitaire === "number"
  );
}

function toJson(commande: Commande): CommandeJson {
  return {
    id: commande.id,
    sessionId: commande.sessionId,
    acheteurId: commande.acheteurId,
    dateCreation: commande.dateCreation.toISOString(),
    tirages: commande.tirages.map((t) => ({
      id: t.id,
      photoNumero: t.photoNumero,
      format: t.format.toDossierName(),
      quantite: t.quantite,
      centimesUnitaire: t.montantUnitaire.centimes,
    })),
  };
}

function fromJson(raw: CommandeJson): Commande {
  return new Commande({
    id: raw.id,
    sessionId: raw.sessionId,
    acheteurId: raw.acheteurId,
    dateCreation: new Date(raw.dateCreation),
    tirages: raw.tirages.map(
      (t) =>
        new Tirage({
          id: t.id,
          photoNumero: t.photoNumero,
          format: Format.depuis(t.format),
          quantite: t.quantite,
          montantUnitaire: new Montant(t.centimesUnitaire),
        }),
    ),
  });
}
