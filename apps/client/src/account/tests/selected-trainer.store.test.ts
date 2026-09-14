import { beforeEach, describe, expect, it } from "vitest";

import { SelectedTrainerStore } from "../selected-trainer.store";

const TRAINER = {
  trainerId: "22222222-2222-4222-8222-222222222222",
  displayName: "Cesar",
  avatarId: "male-01" as const,
  createdAt: "2026-09-14T12:00:00.000Z",
  updatedAt: "2026-09-14T12:00:00.000Z",
};

describe("SelectedTrainerStore", () => {
  let store: SelectedTrainerStore;

  beforeEach(() => {
    store = new SelectedTrainerStore();
  });

  it("starts without a selected trainer", () => {
    expect(store.getSelected()).toBeUndefined();
  });

  it("stores the selected trainer in memory", () => {
    store.select(TRAINER);
    expect(store.getSelected()).toEqual(TRAINER);
  });

  it("clears the selected trainer", () => {
    store.select(TRAINER);
    store.clear();
    expect(store.getSelected()).toBeUndefined();
  });
});
