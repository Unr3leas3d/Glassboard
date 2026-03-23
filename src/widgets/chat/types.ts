// src/widgets/chat/types.ts

export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  text: string;
  timestamp: number;
  color: string;
}
