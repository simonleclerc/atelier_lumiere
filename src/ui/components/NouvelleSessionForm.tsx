import { useState } from "react";
import { Button } from "@/ui/components/ui/button";
import type { CreerSessionUseCase } from "@/domain/usecases/CreerSession";
import type { DossierPicker } from "@/ui/ports/DossierPicker";
import { TYPES_SESSION } from "@/domain/value-objects/TypeSession";

interface Props {
  creerSession: CreerSessionUseCase;
  dossierPicker: DossierPicker;
  onCree: () => void;
  onAnnuler: () => void;
}

export function NouvelleSessionForm({
  creerSession,
  dossierPicker,
  onCree,
  onAnnuler,
}: Props) {
  const [commanditaire, setCommanditaire] = useState("");
  const [referent, setReferent] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<(typeof TYPES_SESSION)[number]>("Spectacle");
  const [dossierSource, setDossierSource] = useState("");
  const [dossierExport, setDossierExport] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function choisir(
    titre: string,
    setter: (v: string) => void,
  ): Promise<void> {
    const chemin = await dossierPicker.choisir(titre);
    if (chemin) setter(chemin);
  }

  async function soumettre(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await creerSession.execute({
        commanditaire,
        referent,
        date: new Date(date),
        type,
        dossierSource,
        dossierExport,
      });
      onCree();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form
      onSubmit={soumettre}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
    >
      <h2 className="text-lg font-semibold">Nouvelle session</h2>

      <label className="flex flex-col gap-1 text-sm">
        Commanditaire
        <input
          value={commanditaire}
          onChange={(e) => setCommanditaire(e.currentTarget.value)}
          placeholder="Théâtre du Soleil, Cie X…"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Référent (contact côté commanditaire)
        <input
          value={referent}
          onChange={(e) => setReferent(e.currentTarget.value)}
          placeholder="Nom + prénom"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.currentTarget.value)}
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1 text-sm">
          Type
          <select
            value={type}
            onChange={(e) =>
              setType(e.currentTarget.value as (typeof TYPES_SESSION)[number])
            }
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {TYPES_SESSION.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span>Dossier source (photos numérotées 1.jpg, 2.jpg…)</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => choisir("Dossier source", setDossierSource)}
          >
            Choisir…
          </Button>
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {dossierSource || "aucun dossier sélectionné"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span>Dossier export (sortie impression)</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => choisir("Dossier export", setDossierExport)}
          >
            Choisir…
          </Button>
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {dossierExport || "aucun dossier sélectionné"}
          </span>
        </div>
      </div>

      {erreur && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {erreur}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onAnnuler}>
          Annuler
        </Button>
        <Button type="submit" disabled={enCours}>
          {enCours ? "Création…" : "Créer la session"}
        </Button>
      </div>
    </form>
  );
}
