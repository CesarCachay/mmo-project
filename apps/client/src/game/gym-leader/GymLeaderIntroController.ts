import type { PokemonGymLeaderPresentationId } from "@cesar-mmo/shared";

import { getGymLeaderAssetDefinition } from "../config/gymLeaderAssets";
import "./gym-leader-intro.css";

const DEFAULT_INTRO_DURATION_MS = 1_650;
const FALLBACK_INTRO_DURATION_MS = 850;

export class GymLeaderIntroController {
  private root?: HTMLDivElement;
  private timeoutId?: number;
  private blocking = false;

  public get isBlockingGameplay(): boolean {
    return this.blocking;
  }

  public present(
    leaderPresentationId: PokemonGymLeaderPresentationId,
    onComplete: () => void,
  ): void {
    this.dismiss();

    const asset = getGymLeaderAssetDefinition(leaderPresentationId);
    const root = document.createElement("div");
    root.className = "gym-leader-intro";
    root.setAttribute("role", "presentation");
    root.setAttribute("aria-hidden", "true");

    const streak = document.createElement("div");
    streak.className = "gym-leader-intro__streak";

    const image = document.createElement("img");
    image.className = "gym-leader-intro__image";
    image.src = asset.introImageUrl;
    image.alt = "";
    image.draggable = false;

    const label = document.createElement("div");
    label.className = "gym-leader-intro__label";
    label.textContent = "GYM LEADER";

    streak.append(image, label);
    root.append(streak);
    document.body.append(root);

    this.root = root;
    this.blocking = true;

    const finish = () => {
      if (this.root !== root) {
        return;
      }

      this.dismiss();
      onComplete();
    };

    image.addEventListener(
      "error",
      () => {
        if (this.root !== root) {
          return;
        }

        /*
         * Missing/corrupt art must never block the battle handshake. Keep a
         * short text-only intro so the transition remains readable, then
         * continue normally.
         */
        root.classList.add("gym-leader-intro--asset-fallback");
        image.remove();

        if (this.timeoutId !== undefined) {
          window.clearTimeout(this.timeoutId);
        }

        this.timeoutId = window.setTimeout(finish, FALLBACK_INTRO_DURATION_MS);
      },
      { once: true },
    );
    this.timeoutId = window.setTimeout(finish, DEFAULT_INTRO_DURATION_MS);
  }

  public dismiss(): void {
    if (this.timeoutId !== undefined) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    this.root?.remove();
    this.root = undefined;
    this.blocking = false;
  }

  public destroy(): void {
    this.dismiss();
  }
}
