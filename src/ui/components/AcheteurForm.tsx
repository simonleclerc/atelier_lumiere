import { useState } from "react";
import { Button } from "@/ui/components/ui/button";

export interface AcheteurFormValeurs {
  readonly nom: string;
  readonly email?: string;
  readonly telephone?: string;
}

interface Props {
  valeursInitiales?: AcheteurFormValeurs;
  onSoumettre: (valeurs: AcheteurFormValeurs) => Promise<void>;
  onAnnuler: () => void;
  titre?: string;
  libelleSubmit?: string;
  libelleSubmitEnCours?: string;
}

export function AcheteurForm({
  valeursInitiales,
  onSoumettre,
  onAnnuler,
  titre = "Nouvel acheteur",
  libelleSubmit = "Ajouter",
  libelleSubmitEnCours = "Ajout…",
}: Props) {
  const [nom, setNom] = useState(valeursInitiales?.nom ?? "");
  const [email, setEmail] = useState(valeursInitiales?.email ?? "");
  const [telephone, setTelephone] = useState(
    valeursInitiales?.telephone ?? "",
  );
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setEnCours(true);
    try {
      await onSoumettre({
        nom,
        email: email || undefined,
        telephone: telephone || undefined,
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
      <h3 className="text-base font-semibold">{titre}</h3>

      <label className="flex flex-col gap-1 text-sm">
        Nom
        <input
          value={nom}
          onChange={(e) => setNom(e.currentTarget.value)}
          placeholder="Martin Dupont"
          required
          autoFocus
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Email <span className="text-muted-foreground">(optionnel)</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          placeholder="martin@example.com"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Téléphone <span className="text-muted-foreground">(optionnel)</span>
        <input
          type="tel"
          value={telephone}
          onChange={(e) => setTelephone(e.currentTarget.value)}
          placeholder="06 12 34 56 78"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

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
