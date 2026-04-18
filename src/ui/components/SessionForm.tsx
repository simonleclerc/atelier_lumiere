import { useState } from "react";
import { Button } from "@/ui/components/ui/button";
import type { DossierPicker } from "@/ui/ports/DossierPicker";
import { TYPES_SESSION, type TypeSession } from "@/domain/value-objects/TypeSession";

export interface SessionFormValeurs {
  readonly commanditaire: string;
  readonly referent: string;
  readonly date: Date;
  readonly type: TypeSession;
  readonly dossierSource: string;
  readonly dossierExport: string;
}

interface Props {
  valeursInitiales?: SessionFormValeurs;
  dossierPicker: DossierPicker;
  onSoumettre: (valeurs: SessionFormValeurs) => Promise<void>;
  onAnnuler: () => void;
  titre?: string;
  libelleSubmit?: string;
  libelleSubmitEnCours?: string;
}

export function SessionForm({
  valeursInitiales,
  dossierPicker,
  onSoumettre,
  onAnnuler,
  titre = "Nouvelle session",
  libelleSubmit = "Créer la session",
  libelleSubmitEnCours = "Création…",
}: Props) {
  const [commanditaire, setCommanditaire] = useState(
    valeursInitiales?.commanditaire ?? "",
  );
  const [referent, setReferent] = useState(valeursInitiales?.referent ?? "");
  const [date, setDate] = useState(
    (valeursInitiales?.date ?? new Date()).toISOString().slice(0, 10),
  );
  const [type, setType] = useState<TypeSession>(
    valeursInitiales?.type ?? "Spectacle",
  );
  const [dossierSource, setDossierSource] = useState(
    valeursInitiales?.dossierSource ?? "",
  );
  const [dossierExport, setDossierExport] = useState(
    valeursInitiales?.dossierExport ?? "",
  );
  const [enCours, setEnCours] = useState(false);

  async function choisir(
    titreDialog: string,
    setter: (v: string) => void,
  ): Promise<void> {
    const chemin = await dossierPicker.choisir(titreDialog);
    if (chemin) setter(chemin);
  }

  async function soumettre(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setEnCours(true);
    try {
      await onSoumettre({
        commanditaire,
        referent,
        date: new Date(date),
        type,
        dossierSource,
        dossierExport,
      });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form
      onSubmit={soumettre}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
    >
      <h2 className="text-lg font-semibold">{titre}</h2>

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
            onChange={(e) => setType(e.currentTarget.value as TypeSession)}
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

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onAnnuler}>
          Annuler
        </Button>
        <Button type="submit" disabled={enCours}>
          {enCours ? libelleSubmitEnCours : libelleSubmit}
        </Button>
      </div>
    </form>
  );
}
