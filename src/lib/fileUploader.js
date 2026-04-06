// src/lib/fileUploader.js
// Converts a File (docx/pdf/txt) or a pasted text string into raw text.
// Document libraries are lazily imported so they are only bundled when used.

/**
 * readFileAsText(input) → Promise<string>
 *
 * input: File object (from <input type="file">) or string (pasted text).
 * Returns the extracted plain text, ready for parseRecipeText().
 */
export async function readFileAsText(input) {
  if (typeof input === 'string') return input;

  const ext = input.name.split('.').pop().toLowerCase();
  if (ext === 'txt')  return readTxt(input);
  if (ext === 'docx') return readDocx(input);
  if (ext === 'pdf')  return readPdf(input);
  throw new Error(`Unsupported file type: .${ext}`);
}

async function readTxt(file) {
  return file.text();
}

async function readDocx(file) {
  const { default: mammoth } = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  // mammoth requires a Node Buffer in Node environments; an ArrayBuffer in browsers
  const input = typeof Buffer !== 'undefined'
    ? { buffer: Buffer.from(arrayBuffer) }
    : { arrayBuffer };
  const result = await mammoth.extractRawText(input);
  return result.value;
}

async function readPdf(file) {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, (_, i) =>
      pdf.getPage(i + 1)
        .then(page => page.getTextContent())
        .then(content => content.items.map(item => item.str).join(' '))
    )
  );
  return pages.join('\n');
}
