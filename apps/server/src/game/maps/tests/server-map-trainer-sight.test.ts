import { describe, expect, it } from 'vitest';

import {
  getServerMapNpc,
  isPlayerInsideTrainerNpcSight,
  isPlayerInsideTrainerNpcSightForInteraction,
} from '../serverMapRegistry.js';

describe('server trainer NPC sight validation', () => {
  it('accepts a player inside Gary sight on route-01', () => {
    const npc = getServerMapNpc('route-01', 'studentGary');

    expect(npc).toBeDefined();
    expect(isPlayerInsideTrainerNpcSight('route-01', 400, 320, npc!)).toBe(
      true,
    );
  });

  it('rejects the route-01 spawn because it is outside Gary sight range', () => {
    const npc = getServerMapNpc('route-01', 'studentGary');

    expect(npc).toBeDefined();
    expect(isPlayerInsideTrainerNpcSight('route-01', 400, 336, npc!)).toBe(
      false,
    );
  });

  it.each([
    ['route02YoungsterDiego', 256, 560],
    ['route02PicnickerValeria', 272, 416],
    ['route02HikerMarcos', 448, 320],
    ['route02AceTrainerLucia', 640, 224],
  ] as const)(
    'accepts tolerant interaction sight for route-02 trainer %s',
    (npcId, playerX, playerY) => {
      const npc = getServerMapNpc('route-02', npcId);

      expect(npc).toBeDefined();
      expect(
        isPlayerInsideTrainerNpcSightForInteraction(
          'route-02',
          playerX,
          playerY,
          npc!,
        ),
      ).toBe(true);
    },
  );
});
