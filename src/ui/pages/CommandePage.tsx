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
                try {
                  await retirerLigne.execute({
                    commandeId: commande.id,
                    ligneId: l.id,
                  });
                  recharger();
                } catch (err) {
                  setErreur(
                    err instanceof Error ? err.message : String(err),
                  );
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
  const [photoNumero, setPhotoNumero] = useState<string>(
    session.photos[0]?.numero.toString() ?? "",
  );
  const [format, setFormat] = useState<string>(Format.TOUS[0].toDossierName());
  const [quantite, setQuantite] = useState<string>("1");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await ajouterLigne.execute({
        commandeId,
        photoNumero: Number(photoNumero),
        format,
        quantite: Number(quantite),
      });
      setQuantite("1");
      onAjoute();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
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
        <label className="flex flex-col gap-1 text-sm">
          Photo
          <select
            value={photoNumero}
            onChange={(e) => setPhotoNumero(e.currentTarget.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {session.photos.map((p) => (
              <option key={p.numero} value={p.numero}>
                n°{p.numero}
              </option>
            ))}
          </select>
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
      {erreur && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {erreur}
        </p>
      )}
      {session.photos.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Aucune photo détectée dans le dossier source de cette session.
        </p>
      )}
    </form>
  );
}
