#!/usr/bin/env python3
"""
Import MIUR schools CSV into the Supabase schools table.

Usage:
  python3 scripts/import_miur_schools.py /path/to/SCUANAGRAFESTAT*.csv

The CSV uses semicolon (;) separator and Latin-1 encoding.
Column mapping:
  CODICESCUOLA → codice_meccanografico
  DENOMINAZIONESCUOLA → denominazione
  DESCRIZIONECOMUNE → comune
  SIGLAPROVINCIA → provincia
  DESCRIZIONEREGIONE → regione
  DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA → tipo_scuola
  INDIRIZZOSCUOLA → indirizzo
"""

import csv
import sys
import subprocess
import os
import tempfile

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 import_miur_schools.py <csv_file>")
        sys.exit(1)

    csv_path = sys.argv[1]
    
    # Read CSV with Latin-1 encoding and semicolon separator
    rows = []
    with open(csv_path, 'r', encoding='latin-1') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            codice = (row.get('CODICESCUOLA') or '').strip()
            denom = (row.get('DENOMINAZIONESCUOLA') or '').strip()
            if not codice or not denom:
                continue
            rows.append({
                'codice_meccanografico': codice,
                'denominazione': denom,
                'comune': (row.get('DESCRIZIONECOMUNE') or '').strip(),
                'provincia': (row.get('SIGLAPROVINCIA') or '').strip(),
                'regione': (row.get('DESCRIZIONEREGIONE') or '').strip(),
                'tipo_scuola': (row.get('DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA') or '').strip(),
                'indirizzo': (row.get('INDIRIZZOSCUOLA') or '').strip(),
            })

    print(f"Parsed {len(rows)} schools from CSV")

    # Write a clean CSV for COPY import
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as tmp:
        writer = csv.writer(tmp)
        writer.writerow(['codice_meccanografico', 'denominazione', 'comune', 'provincia', 'regione', 'tipo_scuola', 'indirizzo'])
        for r in rows:
            writer.writerow([r['codice_meccanografico'], r['denominazione'], r['comune'], r['provincia'], r['regione'], r['tipo_scuola'], r['indirizzo']])
        tmp_path = tmp.name

    # Use psql COPY to import
    copy_sql = f"\\COPY public.schools (codice_meccanografico, denominazione, comune, provincia, regione, tipo_scuola, indirizzo) FROM '{tmp_path}' WITH CSV HEADER"
    
    result = subprocess.run(['psql', '-c', copy_sql], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        # Try INSERT approach as fallback
        print("Trying INSERT fallback...")
        batch_size = 500
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i+batch_size]
            values = []
            for r in batch:
                vals = "({})".format(", ".join([
                    "'{}'".format(v.replace("'", "''")) for v in [
                        r['codice_meccanografico'], r['denominazione'], r['comune'],
                        r['provincia'], r['regione'], r['tipo_scuola'], r['indirizzo']
                    ]
                ]))
                values.append(vals)
            sql = f"INSERT INTO public.schools (codice_meccanografico, denominazione, comune, provincia, regione, tipo_scuola, indirizzo) VALUES {', '.join(values)} ON CONFLICT (codice_meccanografico) DO NOTHING;"
            res = subprocess.run(['psql', '-c', sql], capture_output=True, text=True)
            if res.returncode != 0:
                print(f"Batch {i} error: {res.stderr}")
            else:
                print(f"Imported batch {i}-{i+len(batch)}")
    else:
        print(f"Successfully imported {len(rows)} schools")

    os.unlink(tmp_path)

if __name__ == '__main__':
    main()
