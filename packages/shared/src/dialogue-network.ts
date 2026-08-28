export const DIALOGUE_EVENTS = {
  START: "dialogue:start",
  ADVANCE: "dialogue:advance",
  STATE: "dialogue:state",
} as const;

export interface DialogueStartInput {
  npcId: string;
}

export interface DialogueAdvanceInput {
  sessionId: string;
}

export interface DialogueSessionState {
  sessionId: string;
  npcId: string;
  dialogueId: string;
  lineIndex: number;
  lineCount: number;
  completed: boolean;
}

export function isDialogueStartInput(value: unknown): value is DialogueStartInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.npcId === "string" &&
    record.npcId.trim().length > 0 &&
    record.npcId.length <= 64
  );
}

export function isDialogueAdvanceInput(value: unknown): value is DialogueAdvanceInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.sessionId === "string" &&
    record.sessionId.trim().length > 0 &&
    record.sessionId.length <= 128
  );
}
