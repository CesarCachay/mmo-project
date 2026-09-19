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

  "trainer-student-gary-pre-battle": {
    id: "trainer-student-gary-pre-battle",
    lines: [
      "Hey! You look like a Trainer.",
      "Let's see how strong your Pokémon are!",
    ],
  },

  "trainer-student-francisca-pre-battle": {
    id: "trainer-student-francisca-pre-battle",
    lines: [
      "You made it this far? Nice!",
      "Show me what your Pokémon can do!",
    ],
  },

  "trainer-student-gary-post-battle": {
    id: "trainer-student-gary-post-battle",
    lines: [
      "That was a great battle!",
      "I'll train harder before we battle again someday.",
    ],
  },

  "trainer-student-francisca-post-battle": {
    id: "trainer-student-francisca-post-battle",
    lines: [
      "You got me! Your team was really strong.",
      "I'll keep training too.",
    ],
  },
} satisfies Record<string, DialogueDefinition>;

export type DialogueId = keyof typeof DIALOGUES;

export function getDialogue(dialogueId: string): DialogueDefinition | undefined {
  const dialogues = DIALOGUES as Readonly<Record<string, DialogueDefinition>>;

  return dialogues[dialogueId];
}
