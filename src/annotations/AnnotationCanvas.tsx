// src/annotations/AnnotationCanvas.tsx
import { useRef, useEffect, useCallback, useState } from "react";
import { LaserTool, computeStrokeOpacity } from "./tools/LaserTool";
import type { Stroke, Point } from "./types";

interface AnnotationCanvasProps {
  isDrawMode: boolean;
  localUserId: string;
  remoteStrokes: Stroke[];
  onStroke?: (stroke: Stroke) => void;
  /** Called on every pointer move during active drawing — for live broadcasting */
  onStrokeUpdate?: (stroke: Stroke) => void;
}

export function AnnotationCanvas({
  isDrawMode,
  localUserId,
  remoteStrokes,
  onStroke,
  onStrokeUpdate,
}: AnnotationCanvasProps) {
  const laserToolRef = useRef(new LaserTool());
  const laserTool = laserToolRef.current;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localStrokesRef = useRef<Stroke[]>([]);
  const remoteStrokesRef = useRef<Stroke[]>(remoteStrokes);
  remoteStrokesRef.current = remoteStrokes;
  const animFrameRef = useRef<number>(0);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });

  // Annotation context for the tool
  const getAnnotationContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return { canvas, ctx, localUserId };
  }, [localUserId]);

  // Handle canvas sizing for Retina
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Animation loop
  useEffect(() => {
    const renderFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const now = Date.now();
      const dpr = window.devicePixelRatio || 1;

      // Clear canvas
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.restore();

      // Render local strokes (with decay)
      localStrokesRef.current = localStrokesRef.current.filter((s) => {
        const opacity = computeStrokeOpacity(s, now);
        if (opacity <= 0) return false;
        laserTool.render(ctx, s, opacity);
        return true;
      });

      // Render active stroke (being drawn)
      const active = laserTool.getActiveStroke();
      if (active) {
        laserTool.render(ctx, active, 1);
      }

      // Render remote strokes (read from ref to avoid restarting animation loop)
      for (const stroke of remoteStrokesRef.current) {
        const opacity = computeStrokeOpacity(stroke, now);
        if (opacity > 0) {
          laserTool.render(ctx, stroke, opacity);
        }
      }

      animFrameRef.current = requestAnimationFrame(renderFrame);
    };

    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reads from refs

  // Pointer event handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const actx = getAnnotationContext();
      if (!actx) return;
      const point: Point = { x: e.clientX, y: e.clientY };
      laserTool.onPointerDown(actx, point);
    },
    [getAnnotationContext],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      const actx = getAnnotationContext();
      if (!actx) return;
      const point: Point = { x: e.clientX, y: e.clientY };
      laserTool.onPointerMove(actx, point);

      // Broadcast live stroke update for real-time sync
      const active = laserTool.getActiveStroke();
      if (active) {
        onStrokeUpdate?.(active);
      }
    },
    [getAnnotationContext, onStrokeUpdate],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const active = laserTool.getActiveStroke();
      if (active) {
        // Add completed stroke to local strokes for decay rendering
        localStrokesRef.current.push({ ...active });
        onStroke?.(active);
      }
      const actx = getAnnotationContext();
      if (!actx) return;
      const point: Point = { x: e.clientX, y: e.clientY };
      laserTool.onPointerUp(actx, point);
    },
    [getAnnotationContext, onStroke],
  );

  // Track mouse position for cursor indicator even when not drawing
  useEffect(() => {
    if (!isDrawMode) return;
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [isDrawMode]);

  useEffect(() => {
    if (isDrawMode) {
      return;
    }

    laserTool.cancelActiveStroke();
  }, [isDrawMode, laserTool]);

  return (
    <>
      {/* Laser cursor indicator */}
      {isDrawMode && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 20,
            height: 20,
            transform: `translate(${mousePos.x - 10}px, ${mousePos.y - 10}px)`,
            borderRadius: "50%",
            border: "2px solid rgba(255, 50, 50, 0.85)",
            backgroundColor: "rgba(255, 50, 50, 0.18)",
            pointerEvents: "none",
            zIndex: 9999,
            willChange: "transform",
          }}
        />
      )}

      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: isDrawMode ? "auto" : "none",
          zIndex: 1000,
        }}
        onPointerDown={isDrawMode ? handlePointerDown : undefined}
        onPointerMove={isDrawMode ? handlePointerMove : undefined}
        onPointerUp={isDrawMode ? handlePointerUp : undefined}
      />
    </>
  );
}
