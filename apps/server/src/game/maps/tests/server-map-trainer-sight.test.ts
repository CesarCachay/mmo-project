import { describe, expect, it } from 'vitest';

import {
  getServerMapNpc,
  isPlayerInsideTrainerNpcSight,
} from '../serverMapRegistry.js';

describe('server trainer NPC sight validation', () => {
  it('accepts a player inside Gary sight on route-01', () => {
    const npc = getServerMapNpc('route-01', 'studentGary');

    expect(npc).toBeDefined();
    expect(
      isPlayerInsideTrainerNpcSight('route-01', 400, 320, npc!),
    ).toBe(true);
  });

  it('rejects the route-01 spawn because it is outside Gary sight range', () => {
    const npc = getServerMapNpc('route-01', 'studentGary');

    expect(npc).toBeDefined();
    expect(
      isPlayerInsideTrainerNpcSight('route-01', 400, 336, npc!),
    ).toBe(false);
  });
});
