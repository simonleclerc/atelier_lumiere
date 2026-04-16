/**
 * Union type fermée — alternative légère au VO classe quand les invariants
 * se résument à "l'une de ces valeurs". Le compilo TS fait le travail d'un
 * enum sans les pièges des enum TS (réversibilité, types unions indirectes).
 *
 * `TYPES_SESSION` sert à parser une string externe (form, JSON persistant).
 */
export type TypeSession = "Studio" | "Spectacle";

export const TYPES_SESSION: readonly TypeSession[] = ["Studio", "Spectacle"];

export function parseTypeSession(valeur: string): TypeSession {
  if (TYPES_SESSION.includes(valeur as TypeSession)) {
    return valeur as TypeSession;
  }
  throw new Error(
    `TypeSession inconnu : "${valeur}". Valeurs autorisées : ${TYPES_SESSION.join(", ")}.`,
  );
}
