import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/ui/components/ui/button";
import { GrilleTarifaireEditor } from "@/ui/components/GrilleTarifaireEditor";
import { NouvelAcheteurForm } from "@/ui/components/NouvelAcheteurForm";
import type { Acheteur } from "@/domain/entities/Acheteur";
import type { Commande } from "@/domain/entities/Commande";
import type { Session } from "@/domain/entities/Session";
import { Montant } from "@/domain/value-objects/Montant";
import type { AjouterAcheteurASessionUseCase } from "@/domain/usecases/AjouterAcheteurASession";
import type { ListerCommandesDeSessionUseCase } from "@/domain/usecases/ListerCommandesDeSession";
import type { ModifierPrixSessionUseCase } from "@/domain/usecases/ModifierPrixSession";
import type { PasserCommandeUseCase } from "@/domain/usecases/PasserCommande";
import type { TrouverSessionParIdUseCase } from "@/domain/usecases/TrouverSessionParId";

interface Props {
  sessionId: string;
  ajouterAcheteur: AjouterAcheteurASessionUseCase;
  modifierPrix: ModifierPrixSessionUseCase;
  trouverSession: TrouverSessionParIdUseCase;
  listerCommandes: ListerCommandesDeSessionUseCase;
  passerCommande: PasserCommandeUseCase;
  onRetour: () => void;
  onOuvrirCommande: (commandeId: string) => void;
}

type TriAcheteurs = "ajout" | "alpha" | "ca" | "photos";

const OPTIONS_TRI: { id: TriAcheteurs; label: string }[] = [
  { id: "ajout", label: "Ordre d'ajout" },
  { id: "alpha", label: "Alphabétique" },
  { id: "ca", label: "Chiffre d'affaires" },
  { id: "photos", label: "Nombre de tirages" },
];

export function SessionDetailPage({
  sessionId,
  ajouterAcheteur,
  modifierPrix,
  trouverSession,
  listerCommandes,
  passerCommande,
  onRetour,
  onOuvrirCommande,
}: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [commandes, setCommandes] = useState<readonly Commande[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [triPar, setTriPar] = useState<TriAcheteurs>("ajout");

  const recharger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [s, cmds] = await Promise.all([
        trouverSession.execute(sessionId),
        listerCommandes.execute(sessionId),
      ]);
      setSession(s);
      setCommandes(cmds);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setChargement(false);
    }
  }, [sessionId, trouverSession, listerCommandes]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  const acheteursTries = useMemo(() => {
    if (!session) return [];
    const commandesParAcheteur = (acheteurId: string) =>
      commandes.filter((c) => c.acheteurId === acheteurId);
    const ca = (acheteurId: string) =>
      commandesParAcheteur(acheteurId).reduce(
        (somme, c) => somme.ajouter(c.total()),
        new Montant(0),
      ).centimes;
    const photos = (acheteurId: string) =>
      commandesParAcheteur(acheteurId).reduce(
        (n, c) => n + c.nombreTirages(),
        0,
      );

    const copie = [...session.acheteurs];
    switch (triPar) {
      case "alpha":
        return copie.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
      case "ca":
        return copie.sort((a, b) => ca(b.id) - ca(a.id));
      case "photos":
        return copie.sort((a, b) => photos(b.id) - photos(a.id));
      case "ajout":
      default:
        return copie;
    }
  }, [session, commandes, triPar]);

  if (chargement) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  if (erreur || !session) {
    return (
      <section className="flex flex-col gap-4">
        <Button variant="ghost" onClick={onRetour}>
          ← Retour
        </Button>
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {erreur ?? "Session introuvable."}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Button variant="ghost" className="self-start" onClick={onRetour}>
          ← Retour aux sessions
        </Button>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">{session.commanditaire}</h1>
          <span className="text-sm text-muted-foreground">
            {session.type} · {session.date.toLocaleDateString("fr-FR")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Référent : {session.referent} · {session.nombrePhotos()} photo
          {session.nombrePhotos() > 1 ? "s" : ""}
        </p>
      </header>

      <RecapSession session={session} commandes={commandes} />

      <GrilleTarifaireEditor
        session={session}
        modifierPrix={modifierPrix}
        onMaj={recharger}
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Acheteurs ({session.acheteurs.length})
          </h2>
          <div className="flex items-center gap-2">
            {session.acheteurs.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Trier par
                <select
                  value={triPar}
                  onChange={(e) =>
                    setTriPar(e.currentTarget.value as TriAcheteurs)
                  }
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {OPTIONS_TRI.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!formOuvert && (
              <Button onClick={() => setFormOuvert(true)}>
                Nouvel acheteur
              </Button>
            )}
          </div>
        </div>

        {formOuvert && (
          <NouvelAcheteurForm
            sessionId={session.id}
            ajouterAcheteur={ajouterAcheteur}
            onAjoute={() => {
              setFormOuvert(false);
              recharger();
            }}
            onAnnuler={() => setFormOuvert(false)}
          />
        )}

        {session.acheteurs.length === 0 && !formOuvert && (
          <p className="text-sm text-muted-foreground">
            Aucun acheteur inscrit sur cette session.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {acheteursTries.map((a) => (
            <AcheteurCard
              key={a.id}
              acheteur={a}
              commandes={commandes.filter((c) => c.acheteurId === a.id)}
              sessionId={session.id}
              passerCommande={passerCommande}
              onOuvrirCommande={onOuvrirCommande}
            />
          ))}
        </div>
      </section>
    </section>
  );
}

function RecapSession({
  session,
  commandes,
}: {
  session: Session;
  commandes: readonly Commande[];
}) {
  const caTotal = commandes.reduce(
    (somme, c) => somme.ajouter(c.total()),
    new Montant(0),
  );
  const tiragesTotal = commandes.reduce((n, c) => n + c.nombreTirages(), 0);
  const acheteursActifs = new Set(
    commandes.filter((c) => c.lignes.length > 0).map((c) => c.acheteurId),
  ).size;

  if (commandes.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Récapitulatif</h2>
      <dl className="grid grid-cols-3 gap-3">
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">Chiffre d'affaires</dt>
          <dd className="text-lg font-semibold">{caTotal.toString()}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">Tirages</dt>
          <dd className="text-lg font-semibold">{tiragesTotal}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">
            Acheteurs actifs / total
          </dt>
          <dd className="text-lg font-semibold">
            {acheteursActifs} / {session.acheteurs.length}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function AcheteurCard({
  acheteur,
  commandes,
  sessionId,
  passerCommande,
  onOuvrirCommande,
}: {
  acheteur: Acheteur;
  commandes: readonly Commande[];
  sessionId: string;
  passerCommande: PasserCommandeUseCase;
  onOuvrirCommande: (id: string) => void;
}) {
  const [enCours, setEnCours] = useState(false);

  const tiragesAcheteur = commandes.reduce(
    (n, c) => n + c.nombreTirages(),
    0,
  );
  const caAcheteur = commandes.reduce(
    (somme, c) => somme.ajouter(c.total()),
    new Montant(0),
  );

  async function creerCommande(): Promise<void> {
    setEnCours(true);
    try {
      const c = await passerCommande.execute({
        sessionId,
        acheteurId: acheteur.id,
      });
      onOuvrirCommande(c.id);
    } catch (err) {
      toast.error("Impossible de créer la commande", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex flex-col">
          <h3 className="text-base font-semibold">{acheteur.nom}</h3>
          <div className="flex gap-3 text-xs text-muted-foreground">
            {acheteur.email && <span>{acheteur.email.valeur}</span>}
            {acheteur.telephone && <span>{acheteur.telephone}</span>}
            {!acheteur.email && !acheteur.telephone && (
              <span>aucun contact</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {commandes.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {tiragesAcheteur} tirage{tiragesAcheteur > 1 ? "s" : ""} ·{" "}
              {caAcheteur.toString()}
            </span>
          )}
          <Button variant="outline" onClick={creerCommande} disabled={enCours}>
            {enCours ? "…" : "Passer une commande"}
          </Button>
        </div>
      </header>

      {commandes.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-border/50 pt-2">
          {commandes.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onOuvrirCommande(c.id)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <span className="text-muted-foreground">
                  {c.dateCreation.toLocaleDateString("fr-FR")} ·{" "}
                  {c.lignes.length} ligne{c.lignes.length > 1 ? "s" : ""}
                </span>
                <span className="font-medium">{c.total().toString()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
