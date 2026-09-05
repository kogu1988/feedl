// RFC 4180 uyumlu küçük CSV parser (bağımlılıksız). Virgül/tırnak/yeni satır
// içeren alanlar çift tırnağa alınır; iç tırnaklar ikiye katlanır. Baştaki BOM
// (\uFEFF) temizlenir. Satır sonları CRLF/LF/CR kabul edilir.

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): ParsedCsv {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    // Boş satırları atla (yalnızca tek boş alan).
    if (!(row.length === 1 && row[0] === "")) {
      rows.push(row);
    }
    row = [];
  };

  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      endField();
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      // CRLF'yi tek satır sonu olarak işle.
      if (ch === "\r" && input[i + 1] === "\n") {
        i += 1;
      }
      endRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Son satırda trailing yeni satır yoksa alanları/satırı kapat.
  if (field !== "" || row.length > 0) {
    endRow();
  }

  const headers = rows[0] ?? [];
  return { headers, rows: rows.slice(1) };
}
