import { useEffect, useState } from "react";
import { Button } from "@/ui/components/ui/button";
import { NouvelleSessionForm } from "@/ui/components/NouvelleSessionForm";
import type { Session } from "@/domain/entities/Session";
import type { CreerSessionUseCase } from "@/domain/usecases/CreerSession";
import type { ListerSessionsUseCase } from "@/domain/usecases/ListerSessions";
import type { DossierPicker } from "@/ui/ports/DossierPicker";

interface Props {
  creerSession: CreerSessionUseCase;
  listerSessions: ListerSessionsUseCase;
  dossierPicker: DossierPicker;
  onOuvrirSession: (id: string) => void;
}

export function SessionsPage({
  creerSession,
  listerSessions,
  dossierPicker,
  onOuvrirSession,
}: Props) {
  const [sessions, setSessions] = useState<readonly Session[]>([]);
  const [mode, setMode] = useState<"liste" | "nouveau">("liste");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  async function recharger(): Promise<void> {
    setChargement(true);
    setErreur(null);
    try {
      setSessions(await listerSessions.execute());
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    recharger();
  }, []);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sessions</h1>
        {mode === "liste" && (
          <Button onClick={() => setMode("nouveau")}>Nouvelle session</Button>
        )}
      </header>

      {mode === "nouveau" && (
        <NouvelleSessionForm
          creerSession={creerSession}
          dossierPicker={dossierPicker}
          onCree={() => {
            setMode("liste");
            recharger();
          }}
          onAnnuler={() => setMode("liste")}
        />
      )}

      {mode === "liste" && (
        <div className="flex flex-col gap-2">
          {chargement && (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          )}
          {erreur && (
            <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {erreur}
            </p>
          )}
          {!chargement && sessions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucune session pour l'instant. Clique « Nouvelle session » pour commencer.
            </p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onOuvrirSession(s.id)}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold">{s.commanditaire}</h2>
                <span className="text-xs text-muted-foreground">
                  {s.type} · {s.date.toLocaleDateString("fr-FR")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Référent : {s.referent}
              </p>
              <p className="text-sm">
                {s.nombrePhotos()} photo{s.nombrePhotos() > 1 ? "s" : ""} · {s.acheteurs.length} acheteur
                {s.acheteurs.length > 1 ? "s" : ""}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
