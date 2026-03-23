import { LogicalSize } from "@tauri-apps/api/dpi";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit } from "@tauri-apps/api/event";
import {
  getSessionWindowDefinition,
  SESSION_WINDOW_DEFINITIONS,
  SESSION_WINDOW_IDS,
  type SessionWindowDefinition,
  type SessionWindowId,
} from "./definitions";
import { buildWindowUrl } from "./payload";
import { recordSessionWindowDebug } from "./debug";
import { EVENTS } from "../../types/events";

interface SessionWindowInstance {
  id: SessionWindowId;
  window: WebviewWindow;
  collapsed: boolean;
  hidden: boolean;
}

interface AvailableScreenBounds {
  width: number;
  height: number;
  top: number;
}

const STORAGE_PREFIX = "glasboard_session_window_";

export function getSessionWindowStorageKey(id: SessionWindowId): string {
  return `${STORAGE_PREFIX}${id}`;
}

export function isSessionWindowId(value: string): value is SessionWindowId {
  return SESSION_WINDOW_IDS.includes(value as SessionWindowId);
}

function loadPosition(definition: SessionWindowDefinition) {
  let savedPosition: { x: number; y: number } | undefined;

  try {
    const saved = localStorage.getItem(getSessionWindowStorageKey(definition.id));
    if (saved) {
      savedPosition = JSON.parse(saved) as { x: number; y: number };
    }
  } catch {
    // Ignore malformed local storage and fall back to defaults.
  }

  return sanitizeSessionWindowPosition(definition, savedPosition);
}

function savePosition(id: SessionWindowId, x: number, y: number) {
  localStorage.setItem(
    getSessionWindowStorageKey(id),
    JSON.stringify({ x, y }),
  );
}

function getAvailableScreenBounds(): AvailableScreenBounds {
  return {
    width: window.screen.availWidth,
    height: window.screen.availHeight,
    top: (window.screen as { availTop?: number }).availTop ?? 0,
  };
}

export function sanitizeSessionWindowPosition(
  definition: SessionWindowDefinition,
  savedPosition?: { x: number; y: number },
  screenBounds: AvailableScreenBounds = getAvailableScreenBounds(),
) {
  if (definition.id === "dock") {
    return {
      x: Math.round((screenBounds.width - definition.defaultSize.width) / 2),
      y: screenBounds.top + screenBounds.height - definition.defaultSize.height,
    };
  }

  const maxX = Math.max(0, screenBounds.width - definition.defaultSize.width);
  const maxY = screenBounds.top + Math.max(0, screenBounds.height - definition.defaultSize.height);
  const fallback = definition.defaultPosition;
  const source = savedPosition ?? fallback;

  return {
    x: Math.min(Math.max(source.x, 0), maxX),
    y: Math.min(Math.max(source.y, screenBounds.top), maxY),
  };
}

class SessionWindowCoordinator {
  private instances = new Map<SessionWindowId, SessionWindowInstance>();

  private async showInstance(instance: SessionWindowInstance) {
    if (!instance.hidden) {
      return;
    }

    await instance.window.show().catch(() => {});
    instance.hidden = false;
  }

  private async resolveWindow(id: SessionWindowId) {
    const existing = this.instances.get(id);
    if (existing) {
      return existing;
    }

    const definition = getSessionWindowDefinition(id);
    if (!definition) {
      return null;
    }

    const labels = [definition.label, ...(definition.legacyLabels ?? [])];
    for (const label of labels) {
      const window = await WebviewWindow.getByLabel(label);
      if (window) {
        let hidden = false;
        try {
          hidden = !(await window.isVisible());
        } catch {
          hidden = false;
        }

        const instance: SessionWindowInstance = {
          id,
          window,
          collapsed: false,
          hidden,
        };
        this.instances.set(id, instance);
        return instance;
      }
    }

    return null;
  }

  private registerInstance(id: SessionWindowId, window: WebviewWindow) {
    const instance: SessionWindowInstance = {
      id,
      window,
      collapsed: false,
      hidden: false,
    };

    window.once("tauri://error", (event) => {
      console.error(`[SessionWindowCoordinator] ${id} window error:`, event);
      this.instances.delete(id);
    });

    window.once("tauri://destroyed", () => {
      this.instances.delete(id);
      emit(EVENTS.WIDGET_CLOSED, { widgetId: id }).catch(console.error);
    });

    this.instances.set(id, instance);
    return instance;
  }

  async ensureWindow(id: SessionWindowId, payload?: unknown) {
    const instance = await this.resolveWindow(id);
    if (instance) {
      recordSessionWindowDebug("coordinator:reuse-window", {
        id,
        hidden: instance.hidden,
      });
      await this.showInstance(instance);
      await instance.window.setFocus().catch(() => {});
      return instance.window;
    }

    const definition = getSessionWindowDefinition(id);
    if (!definition) {
      console.error(`[SessionWindowCoordinator] Unknown session window: ${id}`);
      return null;
    }

    const position = loadPosition(definition);
    const window = new WebviewWindow(definition.label, {
      url: buildWindowUrl(definition.route, payload),
      width: definition.defaultSize.width,
      height: definition.defaultSize.height,
      x: position.x,
      y: position.y,
      ...definition.windowOptions,
    });

    recordSessionWindowDebug("coordinator:create-window", {
      id,
      route: definition.route,
    });
    this.registerInstance(id, window);
    await emit(EVENTS.WIDGET_OPENED, { widgetId: id }).catch(console.error);
    return window;
  }

  async focusWindow(id: SessionWindowId) {
    const instance = await this.resolveWindow(id);
    if (!instance) {
      return null;
    }

    await this.showInstance(instance);
    await instance.window.setFocus().catch(() => {});
    return instance.window;
  }

  async closeWindow(id: SessionWindowId) {
    const instance = await this.resolveWindow(id);
    if (!instance) {
      return;
    }

    try {
      const position = await instance.window.outerPosition();
      savePosition(id, position.x, position.y);
    } catch {
      // Window may already be destroyed.
    }

    await instance.window.destroy().catch(() => {});
    this.instances.delete(id);
  }

  async collapseWindow(id: SessionWindowId) {
    const instance = await this.resolveWindow(id);
    const definition = getSessionWindowDefinition(id);
    if (!instance || !definition || instance.collapsed) {
      return;
    }

    await instance.window.setSize(
      new LogicalSize(
        definition.collapsedSize.width,
        definition.collapsedSize.height,
      ),
    );
    instance.collapsed = true;
    await emit(EVENTS.WIDGET_COLLAPSED, { widgetId: id }).catch(console.error);
  }

  async expandWindow(id: SessionWindowId) {
    const instance = await this.resolveWindow(id);
    const definition = getSessionWindowDefinition(id);
    if (!instance || !definition || !instance.collapsed) {
      return;
    }

    await instance.window.setSize(
      new LogicalSize(definition.defaultSize.width, definition.defaultSize.height),
    );
    instance.collapsed = false;
    await emit(EVENTS.WIDGET_EXPANDED, { widgetId: id }).catch(console.error);
  }

  async hideAll() {
    for (const definition of SESSION_WINDOW_DEFINITIONS) {
      const instance = await this.resolveWindow(definition.id);
      if (!instance || instance.hidden) {
        continue;
      }

      await instance.window.hide().catch(() => {});
      instance.hidden = true;
    }
  }

  async showAll() {
    for (const definition of SESSION_WINDOW_DEFINITIONS) {
      const instance = await this.resolveWindow(definition.id);
      if (!instance || !instance.hidden) {
        continue;
      }

      await instance.window.show().catch(() => {});
      instance.hidden = false;
    }
  }

  async setAllContentProtected(protected_: boolean) {
    for (const definition of SESSION_WINDOW_DEFINITIONS) {
      const instance = await this.resolveWindow(definition.id);
      if (!instance) {
        continue;
      }

      await instance.window.setContentProtected(protected_).catch(() => {});
    }
  }

  async destroyAll() {
    for (const definition of SESSION_WINDOW_DEFINITIONS) {
      await this.closeWindow(definition.id);
    }
  }

  async closeWidget(id: SessionWindowId) {
    await this.closeWindow(id);
  }

  async collapseWidget(id: SessionWindowId) {
    await this.collapseWindow(id);
  }

  async expandWidget(id: SessionWindowId) {
    await this.expandWindow(id);
  }

  async hideAllWidgets() {
    await this.hideAll();
  }

  async showAllWidgets() {
    await this.showAll();
  }
}

export const sessionWindowCoordinator = new SessionWindowCoordinator();
