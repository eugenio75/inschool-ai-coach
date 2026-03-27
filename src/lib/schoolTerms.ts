/**
 * Maps internal school_level values to translation keys for school terminology.
 * The internal values stored in Supabase never change — only display labels adapt.
 */

/** Get the translated prep label key for a school level */
export function getPrepLabelKey(schoolLevel: string): string {
  switch (schoolLevel) {
    case "alunno":
      return "prep_alunno";
    case "medie":
      return "prep_medie";
    case "superiori":
      return "prep_superiori";
    case "universitario":
      return "prep_university";
    default:
      return "prep_default";
  }
}

/** Get the translated school level display key */
export function getSchoolLevelKey(schoolLevel: string): string {
  switch (schoolLevel) {
    case "alunno":
    case "elementari":
      return "school_elementari";
    case "medie":
      return "school_medie";
    case "superiori":
      return "school_superiori";
    case "universitario":
      return "school_university";
    case "docente":
      return "school_teacher";
    default:
      return "school_elementari";
  }
}

/** Get the short school level key */
export function getSchoolLevelShortKey(schoolLevel: string): string {
  switch (schoolLevel) {
    case "alunno":
    case "elementari":
      return "school_elementari_short";
    case "medie":
      return "school_medie_short";
    case "superiori":
      return "school_superiori_short";
    case "universitario":
      return "school_university_short";
    default:
      return "school_elementari_short";
  }
}
