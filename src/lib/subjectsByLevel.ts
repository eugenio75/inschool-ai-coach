/**
 * Contextualized subject lists by school level and indirizzo.
 */

const PRIMARIA = [
  "Italiano", "Matematica", "Scienze", "Storia", "Geografia",
  "Inglese", "Arte", "Musica", "Ed. Fisica", "Tecnologia", "Religione",
];

const MEDIE = [
  "Italiano", "Matematica", "Scienze", "Storia", "Geografia",
  "Inglese", "Arte", "Musica", "Ed. Fisica", "Tecnologia",
  "Ed. Civica", "Francese", "Spagnolo", "Tedesco", "Religione",
];

const SUPERIORI_BY_INDIRIZZO: Record<string, string[]> = {
  "Scientifico": [
    "Italiano", "Matematica", "Fisica", "Chimica", "Scienze",
    "Storia", "Filosofia", "Inglese", "Disegno", "Ed. Civica",
  ],
  "Liceo Scientifico": [
    "Italiano", "Matematica", "Fisica", "Chimica", "Scienze",
    "Storia", "Filosofia", "Inglese", "Disegno", "Ed. Civica",
  ],
  "Liceo Scientifico Scienze Applicate": [
    "Italiano", "Matematica", "Fisica", "Chimica", "Scienze",
    "Storia", "Filosofia", "Inglese", "Informatica", "Ed. Civica",
  ],
  "Classico": [
    "Italiano", "Latino", "Greco", "Storia", "Filosofia",
    "Matematica", "Fisica", "Scienze", "Inglese", "Storia dell'Arte",
  ],
  "Liceo Classico": [
    "Italiano", "Latino", "Greco", "Storia", "Filosofia",
    "Matematica", "Fisica", "Scienze", "Inglese", "Storia dell'Arte",
  ],
  "Linguistico": [
    "Italiano", "Inglese", "Lingua 2", "Lingua 3", "Storia",
    "Filosofia", "Matematica", "Scienze", "Storia dell'Arte",
  ],
  "Liceo Linguistico": [
    "Italiano", "Inglese", "Lingua 2", "Lingua 3", "Storia",
    "Filosofia", "Matematica", "Scienze", "Storia dell'Arte",
  ],
  "Liceo Scienze Umane": [
    "Italiano", "Scienze Umane", "Storia", "Filosofia",
    "Matematica", "Fisica", "Diritto", "Inglese",
  ],
  "Liceo Scienze Umane ES": [
    "Italiano", "Scienze Umane", "Diritto ed Economia", "Storia",
    "Filosofia", "Matematica", "Inglese", "Lingua 2",
  ],
};

const SUPERIORI_DEFAULT = [
  "Italiano", "Matematica", "Storia", "Inglese", "Scienze", "Filosofia", "Fisica",
];

/**
 * Returns the subject list for a given school level and optional indirizzo.
 * Does NOT include profile-based subjects — call this as fallback.
 */
export function getSubjectsByLevel(
  schoolLevel: string,
  indirizzo?: string | null,
): string[] {
  // Primaria
  if (
    schoolLevel === "alunno" ||
    schoolLevel === "primaria" ||
    schoolLevel.startsWith("primaria-")
  ) {
    return PRIMARIA;
  }

  // Medie
  if (
    schoolLevel === "medie" ||
    schoolLevel.startsWith("media-")
  ) {
    return MEDIE;
  }

  // Superiori
  if (schoolLevel === "superiori") {
    if (indirizzo && SUPERIORI_BY_INDIRIZZO[indirizzo]) {
      return SUPERIORI_BY_INDIRIZZO[indirizzo];
    }
    return SUPERIORI_DEFAULT;
  }

  // Universitario — no default list (free text)
  if (schoolLevel === "universitario") {
    return [];
  }

  // Fallback
  return SUPERIORI_DEFAULT;
}

/**
 * Returns subjects for onboarding "difficult subjects" step.
 * Same as getSubjectsByLevel but may be slightly different for onboarding context.
 */
export function getOnboardingSubjects(
  schoolLevel: string,
  indirizzo?: string | null,
): string[] {
  return getSubjectsByLevel(schoolLevel, indirizzo);
}
