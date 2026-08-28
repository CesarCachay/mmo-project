export interface DialogueDefinition {
  readonly id: string;
  readonly lines: readonly string[];
}

export const DIALOGUES = {
  "professor-oak-greet": {
    id: "professor-oak-greet",
    lines: ["Welcome to StoneBridge City, choose your favorite Pokemon!"],
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

export type DialogueId = keyof typeof DIALOGUES;

export function getDialogue(dialogueId: string): DialogueDefinition | undefined {
  const dialogues = DIALOGUES as Readonly<Record<string, DialogueDefinition>>;

  return dialogues[dialogueId];
}
