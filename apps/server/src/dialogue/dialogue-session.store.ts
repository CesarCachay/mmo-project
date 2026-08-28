export interface DialogueSession {
  readonly sessionId: string;
  readonly npcId: string;
  readonly dialogueId: string;
  readonly lineIndex: number;
}

export class DialogueSessionStore {
  private readonly sessions = new Map<string, DialogueSession>();

  public create(
    playerId: string,
    npcId: string,
    dialogueId: string,
  ): DialogueSession {
    if (this.sessions.has(playerId)) {
      throw new Error(
        `Player ${playerId} already has an active dialogue session`,
      );
    }

    const session: DialogueSession = {
      sessionId: globalThis.crypto.randomUUID(),
      npcId,
      dialogueId,
      lineIndex: 0,
    };

    this.sessions.set(playerId, session);

    return session;
  }

  public get(playerId: string): DialogueSession | undefined {
    return this.sessions.get(playerId);
  }

  public has(playerId: string): boolean {
    return this.sessions.has(playerId);
  }

  public set(playerId: string, session: DialogueSession): DialogueSession {
    if (!this.sessions.has(playerId)) {
      throw new Error(`Dialogue session not found for player ${playerId}`);
    }

    this.sessions.set(playerId, session);
    return session;
  }

  public remove(playerId: string): void {
    this.sessions.delete(playerId);
  }

  public clear(): void {
    this.sessions.clear();
  }
}
