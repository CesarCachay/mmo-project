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

  "trainer-camper-mateo-pre-battle": {
    id: "trainer-camper-mateo-pre-battle",
    lines: [
      "Route 03 is perfect for testing a growing team!",
      "Let me see if you can handle the climb ahead.",
    ],
  },

  "trainer-camper-mateo-post-battle": {
    id: "trainer-camper-mateo-post-battle",
    lines: [
      "Nice battle! You kept your footing all the way through.",
      "The route gets trickier near the river.",
    ],
  },

  "trainer-picnicker-camila-pre-battle": {
    id: "trainer-picnicker-camila-pre-battle",
    lines: [
      "I stopped here to train beside the meadow.",
      "Your team looks ready for a challenge!",
    ],
  },

  "trainer-picnicker-camila-post-battle": {
    id: "trainer-picnicker-camila-post-battle",
    lines: [
      "Your Pokémon were stronger than I expected!",
      "Keep going north and you'll reach the coast soon.",
    ],
  },

  "trainer-ace-trainer-renato-pre-battle": {
    id: "trainer-ace-trainer-renato-pre-battle",
    lines: [
      "You're almost through Route 03.",
      "Show me you're ready for the next Gym Leader!",
    ],
  },

  "trainer-ace-trainer-renato-post-battle": {
    id: "trainer-ace-trainer-renato-post-battle",
    lines: [
      "Excellent. You didn't lose momentum for a second.",
      "The city ahead has a Gym built around the water.",
    ],
  },

  "gym-leader-brock-pre-battle": {
    id: "gym-leader-brock-pre-battle",
    lines: [
      "Welcome to the StoneBridge Gym.",
      "Show me the strength that brought you this far.",
    ],
  },

  "gym-leader-brock-post-battle": {
    id: "gym-leader-brock-post-battle",
    lines: [
      "Your team stood firm against my defense.",
      "The Boulder Badge is yours. Keep building that strength for the road ahead.",
    ],
  },


  "trainer-swimmer-marina-pre-battle": {
    id: "trainer-swimmer-marina-pre-battle",
    lines: [
      "These lanes are my training ground!",
      "Keep your footing if you want to reach Misty.",
    ],
  },
  "trainer-swimmer-marina-post-battle": {
    id: "trainer-swimmer-marina-post-battle",
    lines: ["Nice balance! The center pier will take you deeper into the pool."],
  },
  "trainer-sailor-nico-pre-battle": {
    id: "trainer-sailor-nico-pre-battle",
    lines: [
      "Water battles are all about momentum.",
      "Let's see if your team can break through the current!",
    ],
  },
  "trainer-sailor-nico-post-battle": {
    id: "trainer-sailor-nico-post-battle",
    lines: ["You handled the current well. Misty is waiting at the far platform."],
  },
  "gym-leader-misty-pre-battle": {
    id: "gym-leader-misty-pre-battle",
    lines: [
      "Welcome to the AzureWave Gym.",
      "You crossed the pool and reached me. Now show me how your team moves under pressure!",
    ],
  },
  "gym-leader-misty-post-battle": {
    id: "gym-leader-misty-post-battle",
    lines: [
      "That was a strong battle. You kept your rhythm even when the tide turned.",
      "The Cascade Badge is yours. Keep moving forward!",
    ],
  },
} satisfies Record<string, DialogueDefinition>;

export type DialogueId = keyof typeof DIALOGUES;

export function getDialogue(dialogueId: string): DialogueDefinition | undefined {
  const dialogues = DIALOGUES as Readonly<Record<string, DialogueDefinition>>;

  return dialogues[dialogueId];
}
