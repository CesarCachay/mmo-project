import { getPokemonItem, type PokemonBattleCompletedPayload } from "@cesar-mmo/shared";

interface ModernBattleCompletionPanelOptions {
  onContinue: () => void;
}

export class ModernBattleCompletionPanel {
  private readonly root: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private readonly icon: HTMLDivElement;
  private readonly effects: HTMLDivElement;
  private readonly eyebrow: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly message: HTMLDivElement;
  private readonly continueButton: HTMLButtonElement;

  constructor(parent: HTMLElement, options: ModernBattleCompletionPanelOptions) {
    this.root = document.createElement("div");

    this.root.className = [
      "battle-modern-completion",
      "battle-ui-modern__interactive",
    ].join(" ");

    const backdrop = document.createElement("div");

    backdrop.className = "battle-modern-completion__backdrop";

    this.card = document.createElement("div");

    this.card.className = [
      "battle-modern-completion__card",
      "battle-ui-modern__surface",
    ].join(" ");

    this.effects = document.createElement("div");
    this.effects.className = "battle-modern-completion__effects";
    this.effects.setAttribute("aria-hidden", "true");

    for (let index = 0; index < 12; index += 1) {
      const particle = document.createElement("span");
      particle.className = "battle-modern-completion__particle";
      this.effects.appendChild(particle);
    }

    this.icon = document.createElement("div");

    this.icon.className = "battle-modern-completion__icon";

    this.icon.textContent = "◆";

    this.eyebrow = document.createElement("div");

    this.eyebrow.className = "battle-modern-completion__eyebrow";

    this.title = document.createElement("div");

    this.title.className = "battle-modern-completion__title";

    this.message = document.createElement("div");

    this.message.className = "battle-modern-completion__message";

    this.continueButton = document.createElement("button");

    this.continueButton.type = "button";

    this.continueButton.className = "battle-modern-completion__continue";

    this.continueButton.textContent = "Continue";

    this.continueButton.addEventListener("click", () => {
      if (this.root.hidden) {
        return;
      }

      /*
       * Evita doble click mientras
       * BattleController cierra la UI.
       */
      this.continueButton.disabled = true;

      options.onContinue();
    });

    this.card.append(
      this.icon,
      this.eyebrow,
      this.title,
      this.message,
      this.continueButton,
    );
    this.root.append(backdrop, this.effects, this.card);
    parent.appendChild(this.root);
    this.hide();
  }

  public show(payload: PokemonBattleCompletedPayload): void {
    const outcome = payload.outcome;
    this.continueButton.textContent = "Continue";

    this.root.classList.remove(
      "battle-modern-completion--victory",
      "battle-modern-completion--defeat",
      "battle-modern-completion--captured",
      "battle-modern-completion--escaped",
      "battle-modern-completion--active",
    );

    switch (outcome) {
      case "wild-defeated":
        this.root.classList.add("battle-modern-completion--victory");
        this.icon.textContent = "★";
        this.eyebrow.textContent = "BATTLE COMPLETE";
        this.title.textContent = "Victory!";
        this.message.textContent = "The wild Pokémon was defeated.";
        break;

      case "trainer-defeated":
        this.root.classList.add("battle-modern-completion--defeat");
        this.icon.textContent = "×";
        this.eyebrow.textContent = "BATTLE COMPLETE";
        this.title.textContent = "Defeat";
        this.message.textContent = "Your party can no longer continue the battle.";
        break;

      case "trainer-battle-victory": {
        this.root.classList.add("battle-modern-completion--victory");
        this.icon.textContent = "★";
        this.eyebrow.textContent = "TRAINER BATTLE COMPLETE";
        this.title.textContent = "Victory!";

        const rewardSummary = this.formatTrainerBattleRewards(
          payload.trainerBattleRewards,
        );

        this.message.textContent = rewardSummary
          ? `The opposing Trainer was defeated. Rewards: ${rewardSummary}.`
          : "The opposing Trainer was defeated.";
        break;
      }

      case "trainer-battle-defeat":
        this.root.classList.add("battle-modern-completion--defeat");
        this.icon.textContent = "×";
        this.eyebrow.textContent = "TRAINER BATTLE COMPLETE";
        this.title.textContent = "Defeated";
        this.message.textContent =
          "Your party can no longer continue. Recover at your last Pokémon Center.";
        this.continueButton.textContent = "Recover";
        break;

      case "trainer-escaped": {
        this.root.classList.add("battle-modern-completion--escaped");
        this.icon.textContent = "↗";
        this.eyebrow.textContent = "BATTLE COMPLETE";
        this.title.textContent = "Escaped!";
        this.message.textContent = "You got away safely.";
        break;
      }

      case "wild-captured": {
        this.root.classList.add("battle-modern-completion--captured");
        this.icon.textContent = "◆";
        this.eyebrow.textContent = "CAPTURE COMPLETE";
        this.title.textContent = "GOTCHA!";
        this.message.textContent = "The wild Pokémon was successfully captured.";

        break;
      }

      default: {
        const exhaustive: never = outcome;
        throw new Error(`Unsupported battle completion outcome: ${String(exhaustive)}`);
      }
    }

    this.continueButton.disabled = false;
    this.root.hidden = false;
    void this.root.offsetWidth;
    this.root.classList.add("battle-modern-completion--active");
  }

  private formatTrainerBattleRewards(
    rewards: PokemonBattleCompletedPayload["trainerBattleRewards"],
  ): string {
    if (!rewards) {
      return "";
    }

    const parts: string[] = [];

    if (rewards.money > 0) {
      parts.push(`₽${rewards.money.toLocaleString("en-US")}`);
    }

    for (const item of rewards.items) {
      const definition = getPokemonItem(item.itemId);
      parts.push(`${definition.name} ×${item.quantity}`);
    }

    return parts.join(" · ");
  }

  public hide(): void {
    this.root.hidden = true;
    this.root.classList.remove("battle-modern-completion--active");
    this.continueButton.disabled = false;
  }

  public destroy(): void {
    this.root.remove();
  }
}
