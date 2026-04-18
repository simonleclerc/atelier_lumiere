import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/ui/components/ui/button";
import type { Commande } from "@/domain/entities/Commande";
import type { Session } from "@/domain/entities/Session";
import type { AjouterLigneACommandeUseCase } from "@/domain/usecases/AjouterLigneACommande";
import type { ExporterCommandeUseCase } from "@/domain/usecases/ExporterCommande";
import type { RetirerLigneDeCommandeUseCase } from "@/domain/usecases/RetirerLigneDeCommande";
import type { TrouverCommandeParIdUseCase } from "@/domain/usecases/TrouverCommandeParId";
import type { TrouverSessionParIdUseCase } from "@/domain/usecases/TrouverSessionParId";
import { Format } from "@/domain/value-objects/Format";

interface Props {
  commandeId: string;
  trouverCommande: TrouverCommandeParIdUseCase;
  trouverSession: TrouverSessionParIdUseCase;
  ajouterLigne: AjouterLigneACommandeUseCase;
  retirerLigne: RetirerLigneDeCommandeUseCase;
  exporter: ExporterCommandeUseCase;
  onRetour: () => void;
}

export function CommandePage({
  commandeId,
  trouverCommande,
  trouverSession,
  ajouterLigne,
  retirerLigne,
  exporter,
  onRetour,
}: Props) {
  const [commande, setCommande] = useState<Commande | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);

  const recharger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const c = await trouverCommande.execute(commandeId);
      setCommande(c);
      setSession(await trouverSession.execute(c.sessionId));
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setChargement(false);
    }
  }, [commandeId, trouverCommande, trouverSession]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  if (chargement) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (erreur || !commande || !session) {
    return (
      <section className="flex flex-col gap-4">
        <Button variant="ghost" className="self-start" onClick={onRetour}>
          ← Retour
        </Button>
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {erreur ?? "Commande ou session introuvable."}
        </p>
      </section>
    );
  }

  const acheteur = session.acheteurs.find((a) => a.id === commande.acheteurId);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Button variant="ghost" className="self-start" onClick={onRetour}>
          ← Retour à la session
        </Button>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">
            Commande {acheteur ? `— ${acheteur.nom}` : ""}
          </h1>
          <span className="text-sm text-muted-foreground">
            {commande.dateCreation.toLocaleDateString("fr-FR")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {session.commanditaire} · {session.type}
        </p>
      </header>

      <AjouterLigneForm
        commandeId={commande.id}
        session={session}
        ajouterLigne={ajouterLigne}
        onAjoute={recharger}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">
          Lignes ({commande.lignes.length})
        </h2>
        {commande.lignes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucune ligne pour l'instant.
          </p>
        )}
        {commande.lignes.map((l) => (
          <article
            key={l.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">
                Photo n°{l.photoNumero} · {l.format.toDossierName()} · ×
                {l.quantite}
              </span>
              <span className="text-xs text-muted-foreground">
                {l.montantUnitaire.toString()} / tirage → {l.total().toString()}
              </span>
            </div>
            <Button
              variant="ghost"
              onClick={async () => {
                const confirme = window.confirm(
                  `Retirer la ligne "photo n°${l.photoNumero} · ${l.format.toDossierName()} · ×${l.quantite}" ?`,
                );
                if (!confirme) return;
                try {
                  await retirerLigne.execute({
                    commandeId: commande.id,
                    ligneId: l.id,
                  });
                  toast.success("Ligne retirée");
                  recharger();
                } catch (err) {
                  toast.error("Retrait impossible", {
                    description:
                      err instanceof Error ? err.message : String(err),
                  });
                }
              }}
            >
              Retirer
            </Button>
          </article>
        ))}

        {commande.lignes.length > 0 && (
          <div className="mt-2 flex flex-col gap-3 border-t border-border pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                Total ({commande.nombreTirages()} tirage
                {commande.nombreTirages() > 1 ? "s" : ""})
              </span>
              <span className="text-lg font-semibold">
                {commande.total().toString()}
              </span>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={async () => {
                  setExportEnCours(true);
                  try {
                    const r = await exporter.execute({ commandeId: commande.id });
                    const mot =
                      r.fichiersCrees > 1 ? "fichiers exportés" : "fichier exporté";
                    toast.success(`${r.fichiersCrees} ${mot}`, {
                      description: session.dossierExport.valeur,
                      duration: 5000,
                    });
                  } catch (err) {
                    toast.error("Export échoué", {
                      description:
                        err instanceof Error ? err.message : String(err),
                      duration: 7000,
                    });
                  } finally {
                    setExportEnCours(false);
                  }
                }}
                disabled={exportEnCours}
              >
                {exportEnCours ? "Export en cours…" : "Exporter vers le dossier"}
              </Button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function AjouterLigneForm({
  commandeId,
  session,
  ajouterLigne,
  onAjoute,
}: {
  commandeId: string;
  session: Session;
  ajouterLigne: AjouterLigneACommandeUseCase;
  onAjoute: () => void;
}) {
  const [photosSaisie, setPhotosSaisie] = useState<string>("");
  const [format, setFormat] = useState<string>(Format.TOUS[0].toDossierName());
  const [quantite, setQuantite] = useState<string>("1");
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setEnCours(true);
    try {
      const numeros = parserNumerosPhotos(photosSaisie);
      if (numeros.length === 0) {
        throw new Error(
          "Indique au moins un numéro de photo (ex : 145 ou 1,3,155).",
        );
      }
      const quantiteNum = Number(quantite);
      let ajoutees = 0;
      for (const n of numeros) {
        await ajouterLigne.execute({
          commandeId,
          photoNumero: n,
          format,
          quantite: quantiteNum,
        });
        ajoutees += 1;
      }
      toast.success(
        `${ajoutees} ligne${ajoutees > 1 ? "s" : ""} ajoutée${ajoutees > 1 ? "s" : ""}`,
        {
          description: `Format ${format} · quantité ${quantiteNum} par photo`,
        },
      );
      setPhotosSaisie("");
      onAjoute();
    } catch (err) {
      toast.error("Ajout impossible", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form
      onSubmit={soumettre}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <h3 className="text-base font-semibold">Ajouter une ligne</h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Photo(s)
          <input
            type="text"
            value={photosSaisie}
            onChange={(e) => setPhotosSaisie(e.currentTarget.value)}
            placeholder="145 ou 1,3,155"
            required
            className="min-w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Format
          <select
            value={format}
            onChange={(e) => setFormat(e.currentTarget.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Format.TOUS.map((f) => {
              const nom = f.toDossierName();
              return (
                <option key={nom} value={nom}>
                  {nom} ({session.grilleTarifaire.prixPour(f).toString()})
                </option>
              );
            })}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Quantité
          <input
            type="number"
            min={1}
            value={quantite}
            onChange={(e) => setQuantite(e.currentTarget.value)}
            required
            className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <Button type="submit" disabled={enCours || session.photos.length === 0}>
          {enCours ? "…" : "Ajouter"}
        </Button>
      </div>
      {session.photos.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Aucune photo détectée dans le dossier source de cette session.
        </p>
      )}
    </form>
  );
}

/**
 * Accepte "145", "1,3,155", "  7 , 12 ,3  ". Rejette tout ce qui n'est pas
 * entier ≥ 1. Dédoublonne en préservant l'ordre de saisie.
 */
function parserNumerosPhotos(saisie: string): number[] {
  const morceaux = saisie
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const numeros: number[] = [];
  const vus = new Set<number>();
  for (const m of morceaux) {
    const n = Number(m);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(
        `"${m}" n'est pas un numéro de photo valide (entier ≥ 1 attendu).`,
      );
    }
    if (!vus.has(n)) {
      vus.add(n);
      numeros.push(n);
    }
  }
  return numeros;
}
