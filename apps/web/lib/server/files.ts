export function sanitizeFilename(filename: string): string {
  const basename = filename.split(/[\\/]/).at(-1) ?? "resume.pdf";
  const cleaned = basename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 180);
  const stem = cleaned.replace(/\.pdf$/i, "") || "resume";
  return `${stem}.pdf`;
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}
