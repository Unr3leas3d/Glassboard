// src/annotations/tools/LaserTool.ts
import type { AnnotationTool, AnnotationContext, Point, Stroke } from "../types";

const DECAY_MS = 2000;
const LOCAL_COLOR = "rgba(255, 50, 50, 0.85)";

let strokeCounter = 0;

function generateStrokeId(userId: string): string {
  return `${userId}-${Date.now()}-${strokeCounter++}`;
}

export class LaserTool implements AnnotationTool {
  id = "laser";
  icon = "Pen";
  cursor = "crosshair";

  private activeStroke: Stroke | null = null;

  onPointerDown(ctx: AnnotationContext, point: Point): void {
    this.activeStroke = {
      id: generateStrokeId(ctx.localUserId),
      points: [point],
      timestamps: [Date.now()],
      userId: ctx.localUserId,
      color: LOCAL_COLOR,
      birthTime: Date.now(),
    };
  }

  onPointerMove(_ctx: AnnotationContext, point: Point): void {
    if (!this.activeStroke) return;
    this.activeStroke.points.push(point);
    this.activeStroke.timestamps.push(Date.now());
  }

  onPointerUp(_ctx: AnnotationContext, _point: Point): void {
    this.activeStroke = null;
  }

  cancelActiveStroke(): void {
    this.activeStroke = null;
  }

  getActiveStroke(): Stroke | null {
    return this.activeStroke;
  }

  render(
    ctx: CanvasRenderingContext2D,
    stroke: Stroke,
    opacity: number,
  ): void {
    const { points, color } = stroke;
    if (points.length < 2) return;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Glow layer — wider, semi-transparent
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.globalAlpha = opacity * 0.3;
    drawSmoothPath(ctx, points);
    ctx.stroke();

    // Core stroke — thinner, brighter
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    ctx.globalAlpha = opacity;
    drawSmoothPath(ctx, points);
    ctx.stroke();

    ctx.restore();
  }

  serialize(stroke: Stroke): unknown {
    return {
      id: stroke.id,
      points: stroke.points,
      timestamps: stroke.timestamps,
      userId: stroke.userId,
      color: stroke.color,
      birthTime: stroke.birthTime,
    };
  }

  deserialize(payload: unknown): Stroke {
    const p = payload as Record<string, unknown>;
    return {
      id: p.id as string,
      points: p.points as Point[],
      timestamps: p.timestamps as number[],
      userId: p.userId as string,
      color: p.color as string,
      birthTime: p.birthTime as number,
    };
  }
}

/**
 * Compute stroke opacity based on age.
 * Returns 0 when the stroke should be removed.
 */
export function computeStrokeOpacity(stroke: Stroke, now: number): number {
  const age = now - stroke.birthTime;
  if (age >= DECAY_MS) return 0;
  return Math.max(0, 1 - age / DECAY_MS);
}

/**
 * Draw a smooth path through points using quadratic bezier curves.
 */
function drawSmoothPath(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length === 0) return;

  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 1) return;

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }

  // Quadratic bezier through midpoints for smooth curves
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }

  // Final segment to last point
  const last = points[points.length - 1];
  const secondLast = points[points.length - 2];
  ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
}
