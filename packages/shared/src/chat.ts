import type { PlayerAvatarId } from "./player/avatar.js";

export const CHAT_MESSAGE_MAX_LENGTH = 200;

export type ChatMessageInput = {
  text: string;
};

export type ChatMessageSender = {
  playerId: string;
  displayName: string;
  avatarId: PlayerAvatarId;
};

export type ChatMessage = {
  id: string;
  sender: ChatMessageSender;
  text: string;
  timestamp: number;
};

export const CHAT_EVENTS = {
  SEND_MESSAGE: "chat:send",
  MESSAGE_RECEIVED: "chat:message",
} as const;

export function isChatMessageInput(value: unknown): value is ChatMessageInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("text" in value)) {
    return false;
  }

  const text = value.text;

  if (typeof text !== "string") {
    return false;
  }

  const normalizedText = text.trim();

  return normalizedText.length > 0 && normalizedText.length <= CHAT_MESSAGE_MAX_LENGTH;
}
