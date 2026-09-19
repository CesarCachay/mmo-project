export class ModernBattlePendingIndicator {
  private readonly root: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "battle-pending-indicator";
    this.root.hidden = true;
    this.root.setAttribute("role", "status");
    this.root.setAttribute("aria-live", "polite");
    this.root.setAttribute("aria-atomic", "true");

    const spinner = document.createElement("span");
    spinner.className = "battle-pending-indicator__spinner";
    spinner.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "battle-pending-indicator__label";
    label.textContent = "SYNCING BATTLE";

    this.root.append(spinner, label);
    parent.appendChild(this.root);
  }

  public setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  public clear(): void {
    this.setVisible(false);
  }

  public destroy(): void {
    this.root.remove();
  }
}
