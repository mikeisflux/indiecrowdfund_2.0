"use client";

import { useEffect, useRef, useState } from "react";
import { getPdfjs } from "@/lib/pdfjs-lazy";

type PdfImagesState =
  | { status: "idle" }
  | { status: "loading"; progress: number }
  | { status: "ready"; images: string[] }
  | { status: "error"; error: string };

// Cache rendered images by URL to avoid re-rendering on reopen
const pdfImageCache = new Map<string, string[]>();

export function usePdfAsImages(
  pdfUrl: string | null,
  opts?: { scale?: number; concurrency?: number }
) {
  const [state, setState] = useState<PdfImagesState>({ status: "idle" });

  const scale = opts?.scale ?? 1.6;
  const concurrency = opts?.concurrency ?? 2;

  // StrictMode / re-run guard
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!pdfUrl) {
      setState({ status: "idle" });
      return;
    }

    // Serve from cache instantly
    const cached = pdfImageCache.get(pdfUrl);
    if (cached?.length) {
      setState({ status: "ready", images: cached });
      return;
    }

    let cancelled = false;
    const runId = ++runIdRef.current;

    (async () => {
      try {
        setState({ status: "loading", progress: 0 });

        // Fetch PDF as ArrayBuffer to avoid CORS issues on mobile
        let pdfData: ArrayBuffer;
        try {
          const response = await fetch(pdfUrl);
          if (!response.ok) {
            throw new Error(`PDF fetch failed: ${response.status}`);
          }
          pdfData = await response.arrayBuffer();
        } catch (fetchError) {
          throw new Error(`PDF Fetch Error: ${fetchError instanceof Error ? fetchError.message : 'Network error'}`);
        }

        const pdfjsLib = await getPdfjs();
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;

        const total = pdf.numPages;

        // Render queue with limited concurrency
        const results: string[] = new Array(total);

        let nextPage = 1;
        let done = 0;

        const renderOne = async () => {
          while (true) {
            if (cancelled || runIdRef.current !== runId) return;

            const pageNo = nextPage++;
            if (pageNo > total) return;

            const page = await pdf.getPage(pageNo);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", { alpha: false });
            if (!ctx) throw new Error("Failed to get canvas context");

            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);

            await page.render({ canvasContext: ctx, viewport, canvas }).promise;

            // Blob URL is faster + smaller than giant dataURL strings
            const blob: Blob = await new Promise((resolve, reject) => {
              canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
                "image/jpeg",
                0.9
              );
            });

            const url = URL.createObjectURL(blob);
            results[pageNo - 1] = url;

            // Free canvas memory
            canvas.width = 0;
            canvas.height = 0;

            done++;
            // ONLY update progress occasionally; don't update images array per page
            if (!cancelled && runIdRef.current === runId) {
              setState((prev) =>
                prev.status === "loading"
                  ? { status: "loading", progress: Math.round((done / total) * 100) }
                  : prev
              );
            }
          }
        };

        // Start workers
        await Promise.all(new Array(concurrency).fill(0).map(() => renderOne()));

        if (cancelled || runIdRef.current !== runId) return;

        pdfImageCache.set(pdfUrl, results);
        setState({ status: "ready", images: results });
      } catch (e) {
        if (cancelled || runIdRef.current !== runId) return;
        setState({
          status: "error",
          error: e instanceof Error ? e.message : "PDF render failed",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, scale, concurrency]);

  // Cleanup helper to clear cache and revoke URLs
  const clearCacheForUrl = (url: string) => {
    const imgs = pdfImageCache.get(url);
    if (imgs) imgs.forEach((u) => URL.revokeObjectURL(u));
    pdfImageCache.delete(url);
  };

  return { state, clearCacheForUrl };
}
