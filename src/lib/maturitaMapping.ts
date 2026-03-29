/** Maturità subject mapping by school track (indirizzo) */

export interface MaturitaTrack {
  label: string;
  secondaProva: string;
  colloquioMaterie: string[];
}

export const MATURITA_TRACKS: Record<string, MaturitaTrack> = {
  "liceo scientifico": {
    label: "Liceo Scientifico",
    secondaProva: "Matematica",
    colloquioMaterie: ["Fisica", "Scienze", "Inglese", "Storia", "Filosofia", "Italiano"],
  },
  "liceo scientifico scienze applicate": {
    label: "Liceo Scientifico opzione Scienze Applicate",
    secondaProva: "Scienze",
    colloquioMaterie: ["Matematica", "Fisica", "Inglese", "Storia", "Informatica"],
  },
  "liceo classico": {
    label: "Liceo Classico",
    secondaProva: "Latino o Greco",
    colloquioMaterie: ["Greco", "Latino", "Italiano", "Storia", "Filosofia", "Inglese", "Matematica"],
  },
  "liceo linguistico": {
    label: "Liceo Linguistico",
    secondaProva: "Lingua straniera 1 + Lingua straniera 2",
    colloquioMaterie: ["Lingua 1", "Lingua 2", "Lingua 3", "Storia", "Italiano"],
  },
  "liceo scienze umane": {
    label: "Liceo delle Scienze Umane",
    secondaProva: "Scienze Umane",
    colloquioMaterie: ["Scienze Umane", "Italiano", "Storia", "Filosofia", "Inglese"],
  },
  "liceo artistico": {
    label: "Liceo Artistico",
    secondaProva: "Discipline di indirizzo",
    colloquioMaterie: ["Storia dell'Arte", "Italiano", "Inglese"],
  },
  "istituto tecnico economico": {
    label: "Istituto Tecnico Economico",
    secondaProva: "Economia Aziendale",
    colloquioMaterie: ["Diritto", "Economia", "Matematica", "Inglese"],
  },
  "istituto tecnico tecnologico": {
    label: "Istituto Tecnico Tecnologico / Informatica",
    secondaProva: "Informatica o Sistemi",
    colloquioMaterie: ["Matematica", "Inglese", "Tecnologie"],
  },
  "istituto tecnico informatica": {
    label: "Istituto Tecnico Tecnologico / Informatica",
    secondaProva: "Informatica o Sistemi",
    colloquioMaterie: ["Matematica", "Inglese", "Tecnologie"],
  },
  "istituto professionale": {
    label: "Istituto Professionale",
    secondaProva: "Materia di indirizzo",
    colloquioMaterie: ["Materie professionali principali"],
  },
};

/** Try to match an indirizzo string to a known track */
export function findMaturitaTrack(indirizzo: string): MaturitaTrack | null {
  if (!indirizzo) return null;
  const normalized = indirizzo.toLowerCase().trim();

  // Direct match
  if (MATURITA_TRACKS[normalized]) return MATURITA_TRACKS[normalized];

  // Partial match
  for (const [key, track] of Object.entries(MATURITA_TRACKS)) {
    if (normalized.includes(key) || key.includes(normalized)) return track;
  }

  // Keyword match
  if (normalized.includes("scientific") || normalized.includes("scientifico")) {
    if (normalized.includes("applicate") || normalized.includes("applied")) return MATURITA_TRACKS["liceo scientifico scienze applicate"];
    return MATURITA_TRACKS["liceo scientifico"];
  }
  if (normalized.includes("classic") || normalized.includes("classico")) return MATURITA_TRACKS["liceo classico"];
  if (normalized.includes("linguist")) return MATURITA_TRACKS["liceo linguistico"];
  if (normalized.includes("umane") || normalized.includes("human")) return MATURITA_TRACKS["liceo scienze umane"];
  if (normalized.includes("artist")) return MATURITA_TRACKS["liceo artistico"];
  if (normalized.includes("economic") || normalized.includes("economico")) return MATURITA_TRACKS["istituto tecnico economico"];
  if (normalized.includes("tecno") || normalized.includes("informatica") || normalized.includes("informatic")) return MATURITA_TRACKS["istituto tecnico tecnologico"];
  if (normalized.includes("professionale") || normalized.includes("professional")) return MATURITA_TRACKS["istituto professionale"];

  return null;
}
