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

  it('accepts a small lateral reconciliation difference for Trainer interaction on mobile', () => {
    const npc = getServerMapNpc('route-01', 'studentGary');

    expect(npc).toBeDefined();
    expect(
      isPlayerInsideTrainerNpcSight('route-01', 412, 320, npc!),
    ).toBe(false);
    expect(
      isPlayerInsideTrainerNpcSightForInteraction('route-01', 412, 320, npc!),
    ).toBe(true);
  });

  it('does not extend the forward sight range while applying mobile tolerance', () => {
    const npc = getServerMapNpc('route-01', 'studentGary');

    expect(npc).toBeDefined();
    expect(
      isPlayerInsideTrainerNpcSightForInteraction('route-01', 400, 336, npc!),
    ).toBe(false);
  });
});
