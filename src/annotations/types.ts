// src/annotations/types.ts

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  timestamps: number[];
  userId: string;
  color: string;
  birthTime: number;
}

export interface AnnotationContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  localUserId: string;
}

export interface AnnotationTool {
  id: string;
  icon: string;
  cursor: string;
  onPointerDown(ctx: AnnotationContext, point: Point): void;
  onPointerMove(ctx: AnnotationContext, point: Point): void;
  onPointerUp(ctx: AnnotationContext, point: Point): void;
  render(
    ctx: CanvasRenderingContext2D,
    stroke: Stroke,
    opacity: number,
  ): void;
  serialize(stroke: Stroke): unknown;
  deserialize(payload: unknown): Stroke;
}
