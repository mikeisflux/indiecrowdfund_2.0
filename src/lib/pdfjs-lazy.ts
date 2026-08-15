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

// pdf.js 5.x calls Promise.withResolvers in 34 places, including in the
// "legacy" build — legacy downlevels *syntax*, not runtime APIs. withResolvers
// landed in Safari 17.4, so on iOS 16 the first getDocument() throws
// "Promise.withResolvers is not a function" and takes the campaign page's
// error boundary with it. That is not a rare device: the reports came from
// Twitter's in-app browser on iOS 16.7, which is exactly how backers arrive
// from a creator's launch post.
//
// Installed before the dynamic import so the module never evaluates without
// it. The worker runs in its own realm and gets the same shim from
// public/pdf-worker-entry.mjs.
function installWithResolvers() {
  const P = Promise as unknown as {
    withResolvers?: <T>() => {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  };
  if (typeof P.withResolvers === "function") return;
  P.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export function getPdfjs(): Promise<PdfjsLib> {
  if (!pdfjsPromise) {
    installWithResolvers();
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((lib) => {
      // Local worker for reliability (served from /public), via a wrapper that
      // shims the worker realm before the real worker evaluates.
      lib.GlobalWorkerOptions.workerSrc = "/pdf-worker-entry.mjs";
      return lib;
    });
  }
  return pdfjsPromise;
}
