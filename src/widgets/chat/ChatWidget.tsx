// src/widgets/chat/ChatWidget.tsx
import { useState, useRef, useEffect, useCallback } from "react";
import { emitTo } from "@tauri-apps/api/event";
import { WidgetShell } from "../../components/WidgetShell";
import { useSessionChannel } from "../../hooks/useSessionChannel";
import { useRealtimeChat } from "../../hooks/useRealtimeChat";
import { decodeWindowPayload } from "../../services/sessionWindows/payload";
import { userColor } from "../../utils/userColor";
import { Send } from "lucide-react";
import { EVENTS } from "../../types/events";
import type { WidgetStateChangePayload } from "../../types/events";
import type { ChatMessage } from "./types";

interface ChatPayload {
  sessionId: string;
  userId: string;
  userName: string;
}

function readPayload(): ChatPayload {
  const params = new URLSearchParams(window.location.search);
  return decodeWindowPayload<ChatPayload>(params.get("payload"), "No payload in chat URL");
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatWidget() {
  const [payload] = useState<ChatPayload>(readPayload);
  const { sessionId, userId, userName } = payload;
  const color = userColor(userId);

  const { channel, isConnected } = useSessionChannel(sessionId);
  const reportUnreadCount = useCallback((unreadCount: number) => {
    const payload: WidgetStateChangePayload = { widgetId: "chat", unreadCount };
    emitTo("overlay", EVENTS.WIDGET_STATE_CHANGE, payload).catch(console.error);
  }, []);

  const { messages, sendMessage, unreadCount, markRead, markHidden } = useRealtimeChat(
    channel,
    isConnected,
    userId,
    userName,
    color,
    reportUnreadCount,
  );

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const syncVisibility = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        markRead();
      } else {
        markHidden();
      }
    };

    const handleFocus = () => markRead();
    const handleBlur = () => markHidden();

    syncVisibility();
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", syncVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", syncVisibility);
      emitTo("overlay", EVENTS.WIDGET_STATE_CHANGE, {
        widgetId: "chat",
        unreadCount: 0,
      } satisfies WidgetStateChangePayload).catch(console.error);
    };
  }, [markHidden, markRead]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  }, [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <WidgetShell widgetId="chat" title="Chat">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-1.5 border-b border-zinc-800 px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-[10px] text-zinc-500">
              {isConnected ? "Connected" : "Connecting..."}
            </span>
          </div>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-300">
              {unreadCount} unread
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
          {messages.length === 0 && (
            <div className="py-8 text-center text-xs text-zinc-600">
              No messages yet
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} isOwn={msg.userId === userId} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex items-center gap-2 border-t border-zinc-800 px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </WidgetShell>
  );
}

function MessageBubble({ msg, isOwn }: { msg: ChatMessage; isOwn: boolean }) {
  return (
    <div className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ backgroundColor: msg.color }}
      >
        {msg.name.slice(0, 2).toUpperCase()}
      </div>
      <div className={`max-w-[75%] ${isOwn ? "text-right" : ""}`}>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-medium text-zinc-400">{msg.name}</span>
          <span className="text-[9px] text-zinc-600">{formatTime(msg.timestamp)}</span>
        </div>
        <div
          className={`mt-0.5 rounded-lg px-2.5 py-1.5 text-sm ${
            isOwn ? "bg-blue-600/20 text-blue-100" : "bg-zinc-800 text-zinc-200"
          }`}
        >
          {msg.text}
        </div>
      </div>
    </div>
  );
}
