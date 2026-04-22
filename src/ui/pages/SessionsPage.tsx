import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/ui/components/ui/button";
import { SessionForm } from "@/ui/components/SessionForm";
import type { Session } from "@/domain/entities/Session";
import type { CreerSessionUseCase } from "@/domain/usecases/CreerSession";
import type { ExporterSauvegardeUseCase } from "@/domain/usecases/ExporterSauvegarde";
import type { ImporterSauvegardeUseCase } from "@/domain/usecases/ImporterSauvegarde";
import type { ListerSessionsUseCase } from "@/domain/usecases/ListerSessions";
import type { DossierPicker } from "@/ui/ports/DossierPicker";
import type { SauvegardeFichierPicker } from "@/ui/ports/SauvegardeFichierPicker";

interface Props {
  creerSession: CreerSessionUseCase;
  listerSessions: ListerSessionsUseCase;
  exporterSauvegarde: ExporterSauvegardeUseCase;
  importerSauvegarde: ImporterSauvegardeUseCase;
  dossierPicker: DossierPicker;
  sauvegardeFichierPicker: SauvegardeFichierPicker;
  onOuvrirSession: (id: string) => void;
}

export function SessionsPage({
  creerSession,
  listerSessions,
  exporterSauvegarde,
  importerSauvegarde,
  dossierPicker,
  sauvegardeFichierPicker,
  onOuvrirSession,
}: Props) {
  const [sessions, setSessions] = useState<readonly Session[]>([]);
  const [mode, setMode] = useState<"liste" | "nouveau">("liste");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false);

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

  async function exporter(): Promise<void> {
    const defaut = `atelier-lumiere-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    const chemin = await sauvegardeFichierPicker.choisirPourExport(defaut);
    if (!chemin) return;
    setSauvegardeEnCours(true);
    try {
      const r = await exporterSauvegarde.execute(chemin);
      toast.success("Sauvegarde exportée", {
        description: `${r.nbSessions} session${r.nbSessions > 1 ? "s" : ""} · ${r.nbCommandes} commande${r.nbCommandes > 1 ? "s" : ""} → ${chemin}`,
      });
    } catch (err) {
      toast.error("Export échoué", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSauvegardeEnCours(false);
    }
  }

  async function importer(): Promise<void> {
    const chemin = await sauvegardeFichierPicker.choisirPourImport();
    if (!chemin) return;
    const confirme = window.confirm(
      "Cela va REMPLACER toutes tes sessions et commandes actuelles par celles du fichier choisi.\n\nContinuer ?",
    );
    if (!confirme) return;
    setSauvegardeEnCours(true);
    try {
      const r = await importerSauvegarde.execute(chemin);
      toast.success("Sauvegarde restaurée", {
        description: `${r.nbSessions} session${r.nbSessions > 1 ? "s" : ""} · ${r.nbCommandes} commande${r.nbCommandes > 1 ? "s" : ""} importée${r.nbSessions + r.nbCommandes > 1 ? "s" : ""}`,
      });
      recharger();
    } catch (err) {
      toast.error("Import échoué", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSauvegardeEnCours(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Sessions</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={importer}
            disabled={sauvegardeEnCours}
          >
            Importer
          </Button>
          <Button
            variant="ghost"
            onClick={exporter}
            disabled={sauvegardeEnCours}
          >
            Sauvegarder
          </Button>
          {mode === "liste" && (
            <Button onClick={() => setMode("nouveau")}>Nouvelle session</Button>
          )}
        </div>
      </header>

      {mode === "nouveau" && (
        <SessionForm
          dossierPicker={dossierPicker}
          onAnnuler={() => setMode("liste")}
          onSoumettre={async (valeurs) => {
            try {
              const session = await creerSession.execute(valeurs);
              toast.success("Session créée", {
                description: `${session.commanditaire} · ${session.nombrePhotos()} photo${session.nombrePhotos() > 1 ? "s" : ""} détectée${session.nombrePhotos() > 1 ? "s" : ""}`,
              });
              setMode("liste");
              recharger();
            } catch (err) {
              toast.error("Création impossible", {
                description: err instanceof Error ? err.message : String(err),
              });
            }
          }}
        />
      )}

      {mode === "liste" && (
        <div className="flex flex-col gap-6">
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
              Aucune session pour l'instant. Clique « Nouvelle session » pour
              commencer.
            </p>
          )}

          <ListeSessions
            titre="Actives"
            sessions={sessions.filter((s) => !s.archivee)}
            onOuvrirSession={onOuvrirSession}
            messageVide="Aucune session active."
          />

          <ListeSessions
            titre="Archivées"
            sessions={sessions.filter((s) => s.archivee)}
            onOuvrirSession={onOuvrirSession}
            messageVide={null}
          />
        </div>
      )}
    </section>
  );
}

function ListeSessions({
  titre,
  sessions,
  onOuvrirSession,
  messageVide,
}: {
  titre: string;
  sessions: readonly Session[];
  onOuvrirSession: (id: string) => void;
  messageVide: string | null;
}) {
  // On masque entièrement la section archivée si elle est vide pour ne pas
  // encombrer l'écran d'un utilisateur qui n'archive jamais.
  if (sessions.length === 0 && messageVide === null) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">
        {titre} ({sessions.length})
      </h2>
      {sessions.length === 0 && messageVide && (
        <p className="text-sm text-muted-foreground">{messageVide}</p>
      )}
      {sessions.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onOuvrirSession(s.id)}
          className={
            "flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted" +
            (s.archivee ? " opacity-70" : "")
          }
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              {s.commanditaire}
              {s.archivee && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase text-muted-foreground">
                  Archivée
                </span>
              )}
            </h3>
            <span className="text-xs text-muted-foreground">
              {s.type} · {s.date.toLocaleDateString("fr-FR")}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Référent : {s.referent}
          </p>
          <p className="text-sm">
            {s.nombrePhotos()} photo{s.nombrePhotos() > 1 ? "s" : ""} ·{" "}
            {s.acheteurs.length} acheteur
            {s.acheteurs.length > 1 ? "s" : ""}
          </p>
        </button>
      ))}
    </section>
  );
}
