/** Test helper: builds a tiny PDF without any PDF library. */
/** Builds a minimal one-page-per-entry PDF with Helvetica text lines. */
export function buildPdf(
  pages: Array<Array<{ text: string; x: number; y: number }>>,
  options: { encrypt?: boolean } = {},
): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) && objects.length;
  const catalog = add("");
  const tree = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const kids: number[] = [];
  for (const lines of pages) {
    const content = `BT /F1 10 Tf ${lines
      .map(
        (l) =>
          `1 0 0 1 ${l.x} ${l.y} Tm (${l.text.replace(/[()\\]/g, "\\$&")}) Tj`,
      )
      .join(" ")} ET`;
    const stream = add(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
    kids.push(
      add(
        `<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 612 792] /Contents ${stream} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`,
      ),
    );
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objects[tree - 1] =
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let encrypt = 0;
  if (options.encrypt) {
    const hex = (n: number) => "00".repeat(n);
    encrypt = add(
      `<< /Filter /Standard /V 1 /R 2 /O <${hex(32)}> /U <${hex(32)}> /P -4 >>`,
    );
  }

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R${
    encrypt
      ? ` /Encrypt ${encrypt} 0 R /ID [<${"11".repeat(16)}> <${"11".repeat(16)}>]`
      : ""
  } >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
