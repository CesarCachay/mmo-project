import {
  MAX_POKEMON_PARTY_SIZE,
  getPokemonGymBadgeDefinition,
  type PokemonGymBadgeId,
  type PokemonInventory,
  type PokemonMoney,
} from "@cesar-mmo/shared";

import { selectedTrainerStore } from "../../account/selected-trainer.store";
import { PLAYER_AVATARS } from "../config/playerAssets";

import "./trainer-drawer.css";

const DRAWER_HIDE_DURATION_MS = 170;

export interface TrainerDrawerOptions {
  readonly onCloseRequested?: () => void;
}

export class TrainerDrawer {
  private readonly root: HTMLElement;

  private readonly closeButton: HTMLButtonElement;

  private readonly avatarPreview: HTMLDivElement;
  private readonly displayName: HTMLHeadingElement;
  private readonly avatarLabel: HTMLSpanElement;

  private readonly partyValue: HTMLSpanElement;
  private readonly inventoryValue: HTMLSpanElement;
  private readonly inventoryMeta: HTMLSpanElement;
  private readonly moneyValue: HTMLSpanElement;

  private readonly trainerIdValue: HTMLSpanElement;
  private readonly createdAtValue: HTMLSpanElement;
  private readonly gymBadgesValue: HTMLSpanElement;

  private readonly onCloseRequested?:
    TrainerDrawerOptions["onCloseRequested"];

  private partyCount = 0;
  private inventoryQuantity = 0;
  private inventoryKinds = 0;
  private money: PokemonMoney = 0;
  private gymBadgeIds: readonly PokemonGymBadgeId[] = [];

  private visible = false;
  private destroyed = false;

  private hideTimer?: number;

  constructor(
    options: TrainerDrawerOptions = {},
  ) {
    const app =
      document.getElementById("app");

    if (!(app instanceof HTMLDivElement)) {
      throw new Error(
        'TrainerDrawer requires "#app"',
      );
    }

    this.onCloseRequested =
      options.onCloseRequested;

    this.root =
      document.createElement("aside");

    this.root.className =
      "trainer-drawer";

    this.root.hidden = true;

    this.root.setAttribute(
      "aria-hidden",
      "true",
    );

    this.root.setAttribute(
      "aria-label",
      "Perfil del Trainer",
    );

    // -------------------------------------------------------
    // Header
    // -------------------------------------------------------

    const header =
      document.createElement("header");

    header.className =
      "trainer-drawer__header";

    const heading =
      document.createElement("div");

    heading.className =
      "trainer-drawer__heading";

    const eyebrow =
      document.createElement("span");

    eyebrow.className =
      "trainer-drawer__eyebrow";

    eyebrow.textContent =
      "Trainer";

    const title =
      document.createElement("h2");

    title.className =
      "trainer-drawer__title";

    title.textContent =
      "Perfil";

    heading.append(
      eyebrow,
      title,
    );

    this.closeButton =
      document.createElement("button");

    this.closeButton.type =
      "button";

    this.closeButton.className =
      "trainer-drawer__close";

    this.closeButton.textContent =
      "×";

    this.closeButton.setAttribute(
      "aria-label",
      "Cerrar perfil del Trainer",
    );

    this.closeButton.addEventListener(
      "click",
      () => {
        this.onCloseRequested?.();
        this.closeButton.blur();
      },
    );

    header.append(
      heading,
      this.closeButton,
    );

    // -------------------------------------------------------
    // Content
    // -------------------------------------------------------

    const content =
      document.createElement("div");

    content.className =
      "trainer-drawer__content";

    const identityCard =
      document.createElement("section");

    identityCard.className =
      "trainer-drawer__identity";

    this.avatarPreview =
      document.createElement("div");

    this.avatarPreview.className =
      "trainer-drawer__avatar";

    this.avatarPreview.setAttribute(
      "aria-hidden",
      "true",
    );

    const identityText =
      document.createElement("div");

    identityText.className =
      "trainer-drawer__identity-text";

    this.displayName =
      document.createElement("h3");

    this.displayName.className =
      "trainer-drawer__display-name";

    this.displayName.textContent =
      "Trainer";

    this.avatarLabel =
      document.createElement("span");

    this.avatarLabel.className =
      "trainer-drawer__avatar-label";

    this.avatarLabel.textContent =
      "Perfil";

    identityText.append(
      this.displayName,
      this.avatarLabel,
    );

    identityCard.append(
      this.avatarPreview,
      identityText,
    );

    // -------------------------------------------------------
    // Summary
    // -------------------------------------------------------

    const summary =
      document.createElement("section");

    summary.className =
      "trainer-drawer__summary";

    const partyStat =
      this.createStat(
        "Equipo",
      );

    this.partyValue =
      partyStat.value;

    const inventoryStat =
      this.createStat(
        "Objetos",
      );

    this.inventoryValue =
      inventoryStat.value;

    this.inventoryMeta =
      document.createElement("span");

    this.inventoryMeta.className =
      "trainer-drawer__stat-meta";

    inventoryStat.root.append(
      this.inventoryMeta,
    );

    const moneyStat =
      this.createStat(
        "Dinero",
      );

    moneyStat.root.classList.add(
      "trainer-drawer__stat--money",
    );

    this.moneyValue =
      moneyStat.value;

    summary.append(
      partyStat.root,
      inventoryStat.root,
      moneyStat.root,
    );

    // -------------------------------------------------------
    // Profile metadata
    // -------------------------------------------------------

    const metadata =
      document.createElement("section");

    metadata.className =
      "trainer-drawer__metadata";

    const metadataTitle =
      document.createElement("h3");

    metadataTitle.className =
      "trainer-drawer__section-title";

    metadataTitle.textContent =
      "Información";

    const trainerIdRow =
      this.createMetadataRow(
        "Trainer ID",
      );

    this.trainerIdValue =
      trainerIdRow.value;

    const createdAtRow =
      this.createMetadataRow(
        "Creado",
      );

    this.createdAtValue =
      createdAtRow.value;

    const gymBadgesRow =
      this.createMetadataRow(
        "Medallas",
      );

    this.gymBadgesValue =
      gymBadgesRow.value;

    this.gymBadgesValue.classList.add(
      "trainer-drawer__metadata-value--badges",
    );

    metadata.append(
      metadataTitle,
      trainerIdRow.root,
      createdAtRow.root,
      gymBadgesRow.root,
    );

    content.append(
      identityCard,
      summary,
      metadata,
    );

    // -------------------------------------------------------
    // Footer
    // -------------------------------------------------------

    const footer =
      document.createElement("footer");

    footer.className =
      "trainer-drawer__footer";

    footer.textContent =
      "Party, Bag y progreso pertenecen a este Trainer.";

    this.root.append(
      header,
      content,
      footer,
    );

    app.append(this.root);

    this.refreshProfile();
    this.renderSummary();
  }

  public setPartyCount(
    count: number,
  ): void {
    this.partyCount =
      Math.max(
        0,
        Math.min(
          MAX_POKEMON_PARTY_SIZE,
          Math.trunc(count),
        ),
      );

    this.renderSummary();
  }

  public setMoney(
    money: PokemonMoney,
  ): void {
    this.money = Math.max(
      0,
      Math.trunc(money),
    );

    this.renderSummary();
  }

  public setGymBadges(
    badgeIds: readonly PokemonGymBadgeId[],
  ): void {
    this.gymBadgeIds = [...new Set(badgeIds)];
    this.renderSummary();
  }

  public setInventory(
    inventory: PokemonInventory,
  ): void {
    this.inventoryKinds =
      inventory.items.length;

    this.inventoryQuantity =
      inventory.items.reduce(
        (
          total,
          stack,
        ) =>
          total +
          stack.quantity,
        0,
      );

    this.renderSummary();
  }

  public show(): void {
    if (this.destroyed) {
      return;
    }

    if (
      this.hideTimer !==
      undefined
    ) {
      window.clearTimeout(
        this.hideTimer,
      );

      this.hideTimer =
        undefined;
    }

    this.refreshProfile();
    this.renderSummary();

    this.visible = true;
    this.root.hidden = false;

    this.root.setAttribute(
      "aria-hidden",
      "false",
    );

    window.requestAnimationFrame(
      () => {
        if (
          !this.visible ||
          this.destroyed
        ) {
          return;
        }

        this.root.classList.add(
          "trainer-drawer--open",
        );
      },
    );
  }

  public hide(): void {
    if (!this.visible) {
      return;
    }

    this.visible = false;

    this.root.classList.remove(
      "trainer-drawer--open",
    );

    this.root.setAttribute(
      "aria-hidden",
      "true",
    );

    if (
      this.hideTimer !==
      undefined
    ) {
      window.clearTimeout(
        this.hideTimer,
      );
    }

    this.hideTimer =
      window.setTimeout(
        () => {
          this.hideTimer =
            undefined;

          if (!this.visible) {
            this.root.hidden =
              true;
          }
        },
        DRAWER_HIDE_DURATION_MS,
      );
  }

  public toggle(): void {
    if (this.visible) {
      this.hide();
      return;
    }

    this.show();
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.visible = false;

    if (
      this.hideTimer !==
      undefined
    ) {
      window.clearTimeout(
        this.hideTimer,
      );

      this.hideTimer =
        undefined;
    }

    this.root.remove();
  }

  private refreshProfile(): void {
    const trainer =
      selectedTrainerStore.getSelected();

    if (!trainer) {
      this.displayName.textContent =
        "Trainer";

      this.avatarLabel.textContent =
        "Perfil no disponible";

      this.avatarPreview.style.removeProperty(
        "background-image",
      );

      this.trainerIdValue.textContent =
        "—";

      this.createdAtValue.textContent =
        "—";

      return;
    }

    this.displayName.textContent =
      trainer.displayName;

    const avatar =
      PLAYER_AVATARS[
        trainer.avatarId
      ];

    this.avatarLabel.textContent =
      avatar.label;

    this.avatarPreview.style.backgroundImage =
      `url("/${avatar.path}/walk-down.png")`;

    this.trainerIdValue.textContent =
      this.formatTrainerId(
        trainer.trainerId,
      );

    this.createdAtValue.textContent =
      this.formatDate(
        trainer.createdAt,
      );
  }

  private renderSummary(): void {
    this.partyValue.textContent =
      `${this.partyCount}/${MAX_POKEMON_PARTY_SIZE}`;

    this.inventoryValue.textContent =
      String(
        this.inventoryQuantity,
      );

    this.inventoryMeta.textContent =
      this.inventoryKinds === 1
        ? "1 tipo"
        : `${this.inventoryKinds} tipos`;

    this.moneyValue.textContent =
      `₽ ${new Intl.NumberFormat("es-PE").format(this.money)}`;

    if (this.gymBadgeIds.length === 0) {
      this.gymBadgesValue.textContent = "Ninguna";
      this.gymBadgesValue.removeAttribute("title");
      return;
    }

    const badgeNames = this.gymBadgeIds.map(
      (badgeId) => getPokemonGymBadgeDefinition(badgeId).displayName,
    );

    this.gymBadgesValue.textContent = badgeNames.join(", ");
    this.gymBadgesValue.title = badgeNames.join(", ");
  }

  private createStat(
    labelText: string,
  ): {
    readonly root:
      HTMLDivElement;
    readonly value:
      HTMLSpanElement;
  } {
    const root =
      document.createElement("div");

    root.className =
      "trainer-drawer__stat";

    const label =
      document.createElement("span");

    label.className =
      "trainer-drawer__stat-label";

    label.textContent =
      labelText;

    const value =
      document.createElement("span");

    value.className =
      "trainer-drawer__stat-value";

    root.append(
      label,
      value,
    );

    return {
      root,
      value,
    };
  }

  private createMetadataRow(
    labelText: string,
  ): {
    readonly root:
      HTMLDivElement;
    readonly value:
      HTMLSpanElement;
  } {
    const root =
      document.createElement("div");

    root.className =
      "trainer-drawer__metadata-row";

    const label =
      document.createElement("span");

    label.className =
      "trainer-drawer__metadata-label";

    label.textContent =
      labelText;

    const value =
      document.createElement("span");

    value.className =
      "trainer-drawer__metadata-value";

    root.append(
      label,
      value,
    );

    return {
      root,
      value,
    };
  }

  private formatTrainerId(
    trainerId: string,
  ): string {
    if (
      trainerId.length <= 14
    ) {
      return trainerId;
    }

    return (
      `${trainerId.slice(0, 8)}` +
      `…${trainerId.slice(-4)}`
    );
  }

  private formatDate(
    value: string,
  ): string {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "es-PE",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    ).format(date);
  }
}
