export interface DialogueDefinition {
  readonly id: string;
  readonly lines: readonly string[];
}

export const DIALOGUES = {
  "professor-oak-greet": {
    id: "professor-oak-greet",
    lines: ["Welcome to StoneBridge City, choose your favorite Pokemon!"],
  },

  "professor-oak-after-starter": {
    id: "professor-oak-after-starter",
    lines: [
      "How is your new partner doing?",
      "I gave you 5 Poké Balls too. Use them to catch wild Pokémon and build your team!",
      "Train together and come back stronger. Your adventure is just beginning!",
    ],
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

  "trainer-youngster-diego-pre-battle": {
    id: "trainer-youngster-diego-pre-battle",
    lines: [
      "Route 02 is where I do all my training!",
      "Three Pokémon should be enough to stop you!",
    ],
  },

  "trainer-youngster-diego-post-battle": {
    id: "trainer-youngster-diego-post-battle",
    lines: [
      "Wow, your team handled mine really well!",
      "I'll keep training before heading toward the city.",
    ],
  },

  "trainer-picnicker-valeria-pre-battle": {
    id: "trainer-picnicker-valeria-pre-battle",
    lines: [
      "The Pokémon around this route are full of surprises.",
      "Let's see how your team deals with mine!",
    ],
  },

  "trainer-picnicker-valeria-post-battle": {
    id: "trainer-picnicker-valeria-post-battle",
    lines: [
      "That was a fun battle!",
      "Your Pokémon work really well together.",
    ],
  },

  "trainer-hiker-marcos-pre-battle": {
    id: "trainer-hiker-marcos-pre-battle",
    lines: [
      "This stretch of Route 02 toughens up any Trainer.",
      "Let's see if your Pokémon can handle some power!",
    ],
  },

  "trainer-hiker-marcos-post-battle": {
    id: "trainer-hiker-marcos-post-battle",
    lines: [
      "Solid battle! You broke through my defense.",
      "The road ahead gets even tougher.",
    ],
  },

  "trainer-ace-trainer-lucia-pre-battle": {
    id: "trainer-ace-trainer-lucia-pre-battle",
    lines: [
      "You're almost through Route 02.",
      "Before you reach the city, show me what you've learned!",
    ],
  },

  "trainer-ace-trainer-lucia-post-battle": {
    id: "trainer-ace-trainer-lucia-post-battle",
    lines: [
      "Excellent battle. You're ready for stronger opponents.",
      "Keep that momentum when you reach the city.",
    ],
  },

} satisfies Record<string, DialogueDefinition>;

export type DialogueId = keyof typeof DIALOGUES;

export function getDialogue(dialogueId: string): DialogueDefinition | undefined {
  const dialogues = DIALOGUES as Readonly<Record<string, DialogueDefinition>>;

  return dialogues[dialogueId];
}
