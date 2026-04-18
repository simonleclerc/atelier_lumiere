import { useCallback, useEffect, useState } from "react";
import { Button } from "@/ui/components/ui/button";
import { GrilleTarifaireEditor } from "@/ui/components/GrilleTarifaireEditor";
import { NouvelAcheteurForm } from "@/ui/components/NouvelAcheteurForm";
import type { Acheteur } from "@/domain/entities/Acheteur";
import type { Commande } from "@/domain/entities/Commande";
import type { Session } from "@/domain/entities/Session";
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

      <GrilleTarifaireEditor
        session={session}
        modifierPrix={modifierPrix}
        onMaj={recharger}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Acheteurs ({session.acheteurs.length})
          </h2>
          {!formOuvert && (
            <Button onClick={() => setFormOuvert(true)}>Nouvel acheteur</Button>
          )}
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
          {session.acheteurs.map((a) => (
            <AcheteurCard
              key={a.id}
              acheteur={a}
              commandes={commandes.filter((c) => c.acheteurId === a.id)}
              sessionId={session.id}
              passerCommande={passerCommande}
              onOuvrirCommande={onOuvrirCommande}
              onErreur={setErreur}
            />
          ))}
        </div>
      </section>
    </section>
  );
}

function AcheteurCard({
  acheteur,
  commandes,
  sessionId,
  passerCommande,
  onOuvrirCommande,
  onErreur,
}: {
  acheteur: Acheteur;
  commandes: readonly Commande[];
  sessionId: string;
  passerCommande: PasserCommandeUseCase;
  onOuvrirCommande: (id: string) => void;
  onErreur: (message: string) => void;
}) {
  const [enCours, setEnCours] = useState(false);

  async function creerCommande(): Promise<void> {
    setEnCours(true);
    try {
      const c = await passerCommande.execute({
        sessionId,
        acheteurId: acheteur.id,
      });
      onOuvrirCommande(c.id);
    } catch (err) {
      onErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex items-baseline justify-between gap-4">
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
        <Button
          variant="outline"
          onClick={creerCommande}
          disabled={enCours}
        >
          {enCours ? "…" : "Passer une commande"}
        </Button>
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
