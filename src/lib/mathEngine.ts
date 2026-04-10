export interface DivisionStep {
  stepIndex: number;
  cifraConsiderata: number;
  domanda: string;
  risposta: number;
  verifica: string;
  rispostaVerifica: number;
  sottrazione: string;
  rispostaSottrazione: number;
  abbassa: string | null;
}

export interface DivisionResult {
  dividendo: number;
  divisore: number;
  quoziente: number;
  resto: number;
  passi: DivisionStep[];
}

export function calcolaDivisione(dividendo: number, divisore: number): DivisionResult {
  const passi: DivisionStep[] = [];
  let resto = 0;
  const cifre = String(dividendo).split("").map(Number);

  for (let i = 0; i < cifre.length; i++) {
    const corrente = resto * 10 + cifre[i];
    const q = Math.floor(corrente / divisore);
    const p = q * divisore;
    const r = corrente - p;
    passi.push({
      stepIndex: i,
      cifraConsiderata: corrente,
      domanda: `Quante volte il ${divisore} sta nel ${corrente}?`,
      risposta: q,
      verifica: `Quanto fa ${q} × ${divisore}?`,
      rispostaVerifica: p,
      sottrazione: `Quanto fa ${corrente} - ${p}?`,
      rispostaSottrazione: r,
      abbassa: i < cifre.length - 1
        ? `Quale cifra abbassiamo? (${cifre[i + 1]})`
        : null,
    });
    resto = r;
  }

  return {
    dividendo,
    divisore,
    quoziente: parseInt(passi.map(p => p.risposta).join("")),
    resto,
    passi,
  };
}

export function verificaRisposta(
  risposta: string | number,
  attesa: string | number
): boolean {
  return String(risposta).trim() === String(attesa).trim();
}
