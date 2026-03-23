// src/hooks/useRealtimeChat.ts
import { useEffect, useCallback, useState, useRef } from "react";
import type { RefObject } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ChatMessage } from "../widgets/chat/types";

let msgCounter = 0;

export function useRealtimeChat(
  channelRef: RefObject<RealtimeChannel | null>,
  isConnected: boolean,
  userId: string,
  userName: string,
  userColor: string,
  onUnreadCountChange?: (unreadCount: number) => void,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isVisibleRef = useRef(true);
  const registeredRef = useRef(false);

  const sendMessage = useCallback(
    (text: string) => {
      const channel = channelRef.current;
      if (!channel || !isConnected || !text.trim()) return;

      const msg: ChatMessage = {
        id: `${userId}-${Date.now()}-${msgCounter++}`,
        userId,
        name: userName,
        text: text.trim(),
        timestamp: Date.now(),
        color: userColor,
      };

      // Add locally immediately
      setMessages((prev) => [...prev, msg]);

      // Broadcast to others
      channel.send({
        type: "broadcast",
        event: "chat_message",
        payload: msg,
      });
    },
    [channelRef, isConnected, userId, userName, userColor],
  );

  // Receive remote messages
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !isConnected) return;
    if (registeredRef.current) return; // already registered

    channel.on("broadcast", { event: "chat_message" }, ({ payload }) => {
      const msg = payload as ChatMessage;
      setMessages((prev) => [...prev, msg]);
      if (!isVisibleRef.current) {
        setUnreadCount((c) => c + 1);
      }
    });
    registeredRef.current = true;

    return () => { registeredRef.current = false; };
  }, [channelRef, isConnected]);

  const markRead = useCallback(() => {
    setUnreadCount(0);
    isVisibleRef.current = true;
  }, []);

  const markHidden = useCallback(() => {
    isVisibleRef.current = false;
  }, []);

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  return { messages, sendMessage, unreadCount, markRead, markHidden };
}
