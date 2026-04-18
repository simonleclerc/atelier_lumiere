import { useState } from "react";
import { Button } from "@/ui/components/ui/button";
import type { AjouterAcheteurASessionUseCase } from "@/domain/usecases/AjouterAcheteurASession";

interface Props {
  sessionId: string;
  ajouterAcheteur: AjouterAcheteurASessionUseCase;
  onAjoute: () => void;
  onAnnuler: () => void;
}

export function NouvelAcheteurForm({
  sessionId,
  ajouterAcheteur,
  onAjoute,
  onAnnuler,
}: Props) {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await ajouterAcheteur.execute({
        sessionId,
        nom,
        email: email || undefined,
        telephone: telephone || undefined,
      });
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
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
    >
      <h3 className="text-base font-semibold">Nouvel acheteur</h3>

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
          {enCours ? "Ajout…" : "Ajouter"}
        </Button>
      </div>
    </form>
  );
}
