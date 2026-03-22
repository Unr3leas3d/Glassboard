interface ScreenMirrorViewProps {
  frameUrl: string;
}

export function ScreenMirrorView({ frameUrl }: ScreenMirrorViewProps) {
  return (
    <img
      src={frameUrl}
      alt="Shared screen"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
        zIndex: 999,
        pointerEvents: "none",
      }}
    />
  );
}
