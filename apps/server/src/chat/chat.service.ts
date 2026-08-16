import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type { ChatMessage, ChatMessageInput, Player } from '@cesar-mmo/shared';

@Injectable()
export class ChatService {
  createMessage(player: Player, input: ChatMessageInput): ChatMessage {
    return {
      id: randomUUID(),

      sender: {
        playerId: player.id,
        displayName: player.displayName,
        avatarId: player.avatarId,
      },

      text: input.text.trim(),
      timestamp: Date.now(),
    };
  }
}
