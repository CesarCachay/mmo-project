import { describe, expect, it } from "vitest";

import type { BattlePresentationEvent } from "@cesar-mmo/shared";

import {
  BATTLE_PRESENTATION_TIMING,
  getBattlePresentationMessageDuration,
} from "./battle-presentation-timing";

describe("status condition presentation timing", () => {
  it("uses a readable duration for status narration", () => {
    const event: BattlePresentationEvent = {
      type: "status-action-prevented",
      participantId: "trainer",
      pokemonInstanceId: "pokemon",
      status: "sleep",
    };

    expect(getBattlePresentationMessageDuration(event)).toBe(
      BATTLE_PRESENTATION_TIMING.statusMessageMs,
    );
  });

  it("keeps residual narration slightly shorter", () => {
    const event: BattlePresentationEvent = {
      type: "status-residual-damage",
      participantId: "trainer",
      pokemonInstanceId: "pokemon",
      status: "poison",
      previousHp: 20,
      currentHp: 17,
      appliedDamage: 3,
    };

    expect(getBattlePresentationMessageDuration(event)).toBe(
      BATTLE_PRESENTATION_TIMING.statusResidualMessageMs,
    );
  });
});
