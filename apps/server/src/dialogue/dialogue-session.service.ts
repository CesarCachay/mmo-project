import { getDialogue, type DialogueSessionState } from '@cesar-mmo/shared';

import {
  DialogueSessionStore,
  type DialogueSession,
} from './dialogue-session.store.js';

export class DialogueSessionService {
  private readonly sessionStore: DialogueSessionStore;

  constructor(sessionStore: DialogueSessionStore) {
    this.sessionStore = sessionStore;
  }

  public start(
    playerId: string,
    npcId: string,
    dialogueId: string,
  ): DialogueSessionState {
    const dialogue = getDialogue(dialogueId);

    if (!dialogue) {
      throw new Error(`Dialogue "${dialogueId}" was not found`);
    }

    if (dialogue.lines.length === 0) {
      throw new Error(`Dialogue "${dialogueId}" has no lines`);
    }

    const session = this.sessionStore.create(playerId, npcId, dialogueId);

    return this.toState(session, dialogue.lines.length, false);
  }

  public advance(playerId: string, sessionId: string): DialogueSessionState {
    const session = this.sessionStore.get(playerId);

    if (!session) {
      throw new Error(`Dialogue session not found for player ${playerId}`);
    }

    if (session.sessionId !== sessionId) {
      throw new Error(`Dialogue session mismatch for player ${playerId}`);
    }

    const dialogue = getDialogue(session.dialogueId);

    if (!dialogue) {
      this.sessionStore.remove(playerId);
      throw new Error(`Dialogue "${session.dialogueId}" was not found`);
    }

    if (dialogue.lines.length === 0) {
      this.sessionStore.remove(playerId);
      throw new Error(`Dialogue "${session.dialogueId}" has no lines`);
    }

    const isLastLine = session.lineIndex >= dialogue.lines.length - 1;

    if (isLastLine) {
      const completedState = this.toState(session, dialogue.lines.length, true);
      this.sessionStore.remove(playerId);
      return completedState;
    }

    const updatedSession: DialogueSession = {
      ...session,

      lineIndex: session.lineIndex + 1,
    };

    this.sessionStore.set(playerId, updatedSession);

    return this.toState(updatedSession, dialogue.lines.length, false);
  }

  private toState(
    session: DialogueSession,
    lineCount: number,
    completed: boolean,
  ): DialogueSessionState {
    return {
      sessionId: session.sessionId,
      npcId: session.npcId,
      dialogueId: session.dialogueId,
      lineIndex: session.lineIndex,
      lineCount,
      completed,
    };
  }
}
