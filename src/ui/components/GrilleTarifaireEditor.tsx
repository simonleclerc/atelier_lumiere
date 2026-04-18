import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/ui/components/ui/button";
import type { Session } from "@/domain/entities/Session";
import type { Format } from "@/domain/value-objects/Format";
import type { Montant } from "@/domain/value-objects/Montant";
import type { ModifierPrixSessionUseCase } from "@/domain/usecases/ModifierPrixSession";

interface Props {
  session: Session;
  modifierPrix: ModifierPrixSessionUseCase;
  onMaj: () => void;
}

export function GrilleTarifaireEditor({
  session,
  modifierPrix,
  onMaj,
}: Props) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Tarifs</h2>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        {session.grilleTarifaire.toEntrees().map(([format, montant]) => (
          <LignePrix
            key={format.toDossierName()}
            sessionId={session.id}
            format={format}
            montant={montant}
            modifierPrix={modifierPrix}
            onMaj={onMaj}
          />
        ))}
      </div>
    </section>
  );
}

interface LignePrixProps {
  sessionId: string;
  format: Format;
  montant: Montant;
  modifierPrix: ModifierPrixSessionUseCase;
  onMaj: () => void;
}

function LignePrix({
  sessionId,
  format,
  montant,
  modifierPrix,
  onMaj,
}: LignePrixProps) {
  const initialEuros = (montant.centimes / 100).toString();
  const [euros, setEuros] = useState(initialEuros);
  const [enCours, setEnCours] = useState(false);

  const aChange = euros !== initialEuros;

  async function enregistrer(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setEnCours(true);
    try {
      const valNum = Number(euros.replace(",", "."));
      if (!Number.isFinite(valNum)) {
        throw new Error("Valeur invalide (attendu : un nombre).");
      }
      await modifierPrix.execute({
        sessionId,
        format: format.toDossierName(),
        centimes: Math.round(valNum * 100),
      });
      toast.success(`Prix ${format.toDossierName()} mis à jour`, {
        description: `${valNum.toFixed(2)} €`,
      });
      onMaj();
    } catch (err) {
      toast.error(`Mise à jour du prix ${format.toDossierName()} impossible`, {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form
      onSubmit={enregistrer}
      className="flex flex-col gap-1 border-b border-border/50 pb-2 last:border-0 last:pb-0"
    >
      <div className="flex items-center gap-3">
        <span className="w-24 text-sm font-medium">
          {format.toDossierName()}
        </span>
        <div className="relative flex-1">
          <input
            type="text"
            inputMode="decimal"
            value={euros}
            onChange={(e) => setEuros(e.currentTarget.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            €
          </span>
        </div>
        <Button
          type="submit"
          variant="outline"
          disabled={!aChange || enCours}
          className="min-w-[96px]"
        >
          {enCours ? "…" : aChange ? "Enregistrer" : "À jour"}
        </Button>
      </div>
    </form>
  );
}
