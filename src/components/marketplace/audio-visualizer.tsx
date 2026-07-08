"use client";

import { useRef, useEffect, useCallback } from "react";

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  width?: number;
  height?: number;
  barCount?: number;
  className?: string;
}

export function AudioVisualizer({
  analyser,
  isPlaying,
  width = 120,
  height = 40,
  barCount = 32,
  className,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (!analyser || !isPlaying) {
      // Draw idle bars
      const barW = (width / barCount) * 0.6;
      const gap = width / barCount;
      for (let i = 0; i < barCount; i++) {
        const h = 2 + Math.random() * 3;
        const x = i * gap + (gap - barW) / 2;
        const gradient = ctx.createLinearGradient(0, height, 0, height - h);
        gradient.addColorStop(0, "rgba(168, 85, 247, 0.3)");
        gradient.addColorStop(1, "rgba(236, 72, 153, 0.3)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, height - h, barW, h, 1);
        ctx.fill();
      }
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const barW = (width / barCount) * 0.6;
    const gap = width / barCount;
    const step = Math.floor(bufferLength / barCount);

    for (let i = 0; i < barCount; i++) {
      const idx = i * step;
      const value = dataArray[idx] / 255;
      const barH = Math.max(2, value * height * 0.9);
      const x = i * gap + (gap - barW) / 2;

      const gradient = ctx.createLinearGradient(0, height, 0, height - barH);
      gradient.addColorStop(0, "rgba(168, 85, 247, 0.8)");
      gradient.addColorStop(0.5, "rgba(236, 72, 153, 0.8)");
      gradient.addColorStop(1, "rgba(251, 146, 60, 0.9)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, height - barH, barW, barH, 1.5);
      ctx.fill();
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [analyser, isPlaying, width, height, barCount]);

  useEffect(() => {
    if (isPlaying && analyser) {
      animFrameRef.current = requestAnimationFrame(draw);
    } else {
      // Draw one idle frame
      draw();
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, analyser, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ width, height }}
    />
  );
}
