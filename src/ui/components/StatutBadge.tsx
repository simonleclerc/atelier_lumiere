import type { StatutExport } from "@/domain/value-objects/StatutExport";
import { cn } from "@/ui/lib/utils";

interface Props {
  statut: StatutExport;
  className?: string;
}

const LABELS: Record<StatutExport["nature"], string> = {
  "pas-exporte": "Pas exporté",
  incomplet: "Export incomplet",
  erreur: "Erreur d'export",
  complet: "Exporté",
};

const CLASSES: Record<StatutExport["nature"], string> = {
  "pas-exporte": "bg-muted text-muted-foreground",
  incomplet:
    "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  erreur: "bg-destructive/15 text-destructive",
  complet: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-500",
};

export function StatutBadge({ statut, className }: Props) {
  return (
    <span
      title={statut.messageErreur}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        CLASSES[statut.nature],
        className,
      )}
    >
      {LABELS[statut.nature]}
    </span>
  );
}
