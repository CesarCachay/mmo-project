export class BattleDomRoot {
  private readonly root: HTMLDivElement;

  constructor() {
    const app = document.getElementById("app");

    if (!app) {
      throw new Error('Battle UI requires "#app" root element');
    }

    this.root = document.createElement("div");

    this.root.className = "battle-ui-modern";

    this.root.hidden = true;

    this.root.setAttribute("data-battle-ui", "true");

    app.appendChild(this.root);
  }

  public get element(): HTMLDivElement {
    return this.root;
  }

  public show(): void {
    this.root.hidden = false;
  }

  public hide(): void {
    this.root.hidden = true;
  }

  public clear(): void {
    this.root.replaceChildren();
  }

  public destroy(): void {
    this.root.remove();
  }
}
