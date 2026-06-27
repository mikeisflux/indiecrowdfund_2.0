// Lazy, browser-only loader for pdf.js.
//
// Importing pdfjs-dist at module top level evaluates code that touches
// DOMMatrix (a browser-only global). When any Server Component statically
// pulls in a module that imports pdf.js, that evaluation runs during SSR
// and crashes with "ReferenceError: DOMMatrix is not defined" (e.g. the
// backer dashboard, which imports the PDF thumbnail + reader components).
//
// Loading pdf.js on demand inside browser-only async paths keeps the
// import off the server entirely — this module is safe to import anywhere
// because the dynamic import() only executes when getPdfjs() is called.
type PdfjsLib = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfjsLib> | null = null;

export function getPdfjs(): Promise<PdfjsLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((lib) => {
      // Local worker for reliability (served from /public).
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pdfjsPromise;
}
