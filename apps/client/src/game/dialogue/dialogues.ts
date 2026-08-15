import type { DialogueDefinition } from "./types";

export const DIALOGUES = {
  "professor-oak-greet": {
    id: "professor-oak-greet",
    lines: ["Welcome to StoneBridge City!"],
  },

  "dra-gianela-intro": {
    id: "dra-gianela-intro",
    lines: [
      "Hello! It's nice to meet you.",
      "I've been studying the people who arrive in StoneBridge.",
      "It looks like this place is becoming quite popular.",
    ],
  },
} satisfies Record<string, DialogueDefinition>;

type DialogueId = keyof typeof DIALOGUES;

function isDialogueId(dialogueId: string): dialogueId is DialogueId {
  return dialogueId in DIALOGUES;
}

export function getDialogue(dialogueId: string): DialogueDefinition | undefined {
  if (!isDialogueId(dialogueId)) {
    return undefined;
  }

  return DIALOGUES[dialogueId];
}
