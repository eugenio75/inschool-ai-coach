import { Link } from "react-router-dom";

export function LegalDisclaimer() {
  return (
    <div className="mt-6 pt-4 border-t border-border">
      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        InSchool non verifica l'identità degli utenti. Dichiarando la tua data di nascita confermi
        che le informazioni fornite sono veritiere e accurate. Per i minori di 14 anni è richiesta la
        supervisione di un adulto responsabile. Il trattamento dei dati avviene nel rispetto del{" "}
        <Link to="/privacy-policy" className="text-primary hover:underline">GDPR</Link>{" "}
        (Reg. UE 2016/679), del{" "}
        <Link to="/privacy-policy" className="text-primary hover:underline">D.Lgs. 196/2003</Link>{" "}
        e s.m.i., e del Regolamento UE sull'Intelligenza Artificiale (
        <Link to="/eu-ai-act" className="text-primary hover:underline">AI Act 2024</Link>
        ). InSchool non è responsabile per dichiarazioni false sull'età.
      </p>
    </div>
  );
}
