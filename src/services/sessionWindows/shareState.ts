export type ShareState =
  | { status: "idle" }
  | { status: "selecting-source"; source?: number }
  | { status: "sharing"; source: number }
  | { status: "error"; source?: number; message?: string };

export type ShareEvent =
  | { type: "OPEN_PICKER"; source?: number }
  | { type: "SOURCE_SELECTED"; source: number }
  | { type: "STARTED"; source: number }
  | { type: "STOP" }
  | { type: "CAPTURE_FAILED"; message?: string }
  | { type: "CLEAR_ERROR" };

export function transitionShareState(state: ShareState, event: ShareEvent): ShareState {
  switch (event.type) {
    case "OPEN_PICKER":
      return { status: "selecting-source", source: event.source };
    case "SOURCE_SELECTED":
    case "STARTED":
      return { status: "sharing", source: event.source };
    case "STOP":
    case "CLEAR_ERROR":
      return { status: "idle" };
    case "CAPTURE_FAILED":
      return {
        status: "error",
        source: "source" in state ? state.source : undefined,
        message: event.message,
      };
    default:
      return state;
  }
}
