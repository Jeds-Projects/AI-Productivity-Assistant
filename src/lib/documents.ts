/** Local, in-browser text extraction for PDF, DOCX and TXT files. */

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

function ext(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
      .join("");
    pages.push(line);
  }
  return pages.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const mod = await import("mammoth/mammoth.browser.min.js");
  const mammoth = (mod as { default?: typeof mod }).default ?? mod;
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

export async function extractText(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File is larger than 10 MB. Please upload a smaller document.");
  }
  const e = ext(file.name);
  let text = "";
  try {
    if (e === ".pdf") text = await extractPdf(file);
    else if (e === ".docx") text = await extractDocx(file);
    else if (e === ".txt" || e === ".md") text = await file.text();
    else throw new Error("Unsupported file type. Upload a PDF, DOCX or TXT file.");
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Unsupported")) throw err;
    console.error(err);
    throw new Error(`Couldn't read "${file.name}". The file may be corrupted or password-protected.`);
  }
  const cleaned = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned) {
    throw new Error(
      "No readable text found. Scanned PDFs (images) aren't supported — paste the notes instead.",
    );
  }
  return cleaned;
}
