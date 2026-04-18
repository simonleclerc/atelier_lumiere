import { useCallback, useEffect, useState } from "react";
import { Button } from "@/ui/components/ui/button";
import { NouvelAcheteurForm } from "@/ui/components/NouvelAcheteurForm";
import type { Session } from "@/domain/entities/Session";
import type { AjouterAcheteurASessionUseCase } from "@/domain/usecases/AjouterAcheteurASession";
import type { TrouverSessionParIdUseCase } from "@/domain/usecases/TrouverSessionParId";

interface Props {
  sessionId: string;
  ajouterAcheteur: AjouterAcheteurASessionUseCase;
  trouverSession: TrouverSessionParIdUseCase;
  onRetour: () => void;
}

export function SessionDetailPage({
  sessionId,
  ajouterAcheteur,
  trouverSession,
  onRetour,
}: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);

  const recharger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setSession(await trouverSession.execute(sessionId));
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setChargement(false);
    }
  }, [sessionId, trouverSession]);

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

        <div className="flex flex-col gap-2">
          {session.acheteurs.map((a) => (
            <article
              key={a.id}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4"
            >
              <h3 className="text-base font-semibold">{a.nom}</h3>
              <div className="flex gap-4 text-xs text-muted-foreground">
                {a.email && <span>{a.email.valeur}</span>}
                {a.telephone && <span>{a.telephone}</span>}
                {!a.email && !a.telephone && (
                  <span>aucun contact renseigné</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
