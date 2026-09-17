import "./chat-dock.css";

import Phaser from "phaser";

import type { ChatMessage } from "@cesar-mmo/shared";
import { CHAT_MESSAGE_MAX_LENGTH } from "@cesar-mmo/shared";

const CHAT_MAX_HISTORY = 100;
const CHAT_REOPEN_BLOCK_MS = 150;
const CHAT_SCROLL_BOTTOM_THRESHOLD_PX = 24;

type ChatSubmitHandler = (text: string) => void;

type ChatEntry = {
  message: ChatMessage;
  isOwn: boolean;
};

export class ChatDock {
  private readonly scene: Phaser.Scene;

  private readonly onSubmit: ChatSubmitHandler;

  private readonly root: HTMLDivElement;

  private readonly collapsedButton: HTMLButtonElement;

  private readonly unreadBadge: HTMLSpanElement;

  private readonly panel: HTMLDivElement;

  private readonly messagesViewport: HTMLDivElement;

  private readonly inputElement: HTMLInputElement;

  private readonly messages: ChatEntry[] = [];

  private externalVisible = true;

  private expanded = false;

  private inputActive = false;

  private unreadCount = 0;

  private reopenBlockedUntil = 0;

  private destroyed = false;

  constructor(scene: Phaser.Scene, onSubmit: ChatSubmitHandler) {
    this.scene = scene;
    this.onSubmit = onSubmit;

    const app = document.getElementById("app");

    if (!(app instanceof HTMLDivElement)) {
      throw new Error('ChatDock requires "#app"');
    }

    // ---------------------------------------------------------
    // Root
    // ---------------------------------------------------------

    this.root = document.createElement("div");
    this.root.className = "game-chat-dock";

    // ---------------------------------------------------------
    // Collapsed trigger
    // ---------------------------------------------------------

    this.collapsedButton = document.createElement("button");
    this.collapsedButton.type = "button";
    this.collapsedButton.className = "game-chat-dock__collapsed";
    this.collapsedButton.setAttribute("aria-expanded", "false");
    this.collapsedButton.setAttribute("aria-label", "Abrir chat");

    const collapsedIcon = document.createElement("span");
    collapsedIcon.className = "game-chat-dock__collapsed-icon";
    collapsedIcon.textContent = "Chat";

    this.unreadBadge = document.createElement("span");
    this.unreadBadge.className = "game-chat-dock__unread";
    this.unreadBadge.hidden = true;

    this.collapsedButton.append(collapsedIcon, this.unreadBadge);

    // ---------------------------------------------------------
    // Expanded panel
    // ---------------------------------------------------------

    this.panel = document.createElement("div");
    this.panel.className = "game-chat-dock__panel";
    this.panel.hidden = true;

    const header = document.createElement("div");
    header.className = "game-chat-dock__header";

    const title = document.createElement("span");
    title.className = "game-chat-dock__title";
    title.textContent = "Chat";

    const minimizeButton = document.createElement("button");
    minimizeButton.type = "button";
    minimizeButton.className = "game-chat-dock__minimize";
    minimizeButton.textContent = "—";
    minimizeButton.setAttribute("aria-label", "Minimizar chat");

    header.append(title, minimizeButton);

    // ---------------------------------------------------------
    // Messages
    // ---------------------------------------------------------

    this.messagesViewport = document.createElement("div");
    this.messagesViewport.className = "game-chat-dock__messages";
    this.messagesViewport.setAttribute("aria-live", "polite");
    this.messagesViewport.setAttribute("aria-relevant", "additions");

    // ---------------------------------------------------------
    // Composer
    // ---------------------------------------------------------

    const composer = document.createElement("div");
    composer.className = "game-chat-dock__composer";

    this.inputElement = document.createElement("input");
    this.inputElement.type = "text";
    this.inputElement.className = "game-chat-dock__input";
    this.inputElement.placeholder = "Escribe un mensaje...";
    this.inputElement.maxLength = CHAT_MESSAGE_MAX_LENGTH;
    this.inputElement.autocomplete = "off";

    this.inputElement.spellcheck = false;
    this.inputElement.setAttribute("enterkeyhint", "send");

    composer.append(this.inputElement);

    this.panel.append(header, this.messagesViewport, composer);

    this.root.append(this.collapsedButton, this.panel);

    app.append(this.root);

    // ---------------------------------------------------------
    // Interaction
    // ---------------------------------------------------------

    this.collapsedButton.addEventListener("click", () => {
      this.open();

      const isTouchPrimary = window.matchMedia(
        "(hover: none) and (pointer: coarse)"
      ).matches;

      if (!isTouchPrimary) {
        return;
      }

      requestAnimationFrame(() => {
        if (this.destroyed || !this.externalVisible || !this.expanded) {
          return;
        }

        this.inputElement.focus({
          preventScroll: true,
        });
      });
    });
    minimizeButton.addEventListener("click", () => {
      this.collapse();
    });

    this.inputElement.addEventListener("focus", () => {
      this.inputActive = true;
      this.markRead();
    });

    this.inputElement.addEventListener("blur", () => {
      this.inputActive = false;
    });

    this.inputElement.addEventListener("keydown", this.handleInputKeyDown);

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroy();
    });

    this.syncPresentation();
  }

  public addMessage(message: ChatMessage, isOwn: boolean): void {
    if (this.destroyed) {
      return;
    }

    const wasNearBottom = this.isMessagesViewportNearBottom();

    this.messages.push({
      message,
      isOwn,
    });

    if (this.messages.length > CHAT_MAX_HISTORY) {
      const excess = this.messages.length - CHAT_MAX_HISTORY;

      this.messages.splice(0, excess);
    }

    this.renderMessages();

    const shouldCountAsUnread = !isOwn && (!this.externalVisible || !this.expanded);

    if (shouldCountAsUnread) {
      this.unreadCount += 1;
      this.syncUnreadBadge();
    }

    if (this.externalVisible && this.expanded && (isOwn || wasNearBottom)) {
      this.scrollToLatest();
    }
  }

  public isTyping(): boolean {
    return this.inputActive && document.activeElement === this.inputElement;
  }

  public focusInput(): void {
    if (this.destroyed) {
      return;
    }

    if (!this.externalVisible) {
      return;
    }

    if (this.scene.time.now < this.reopenBlockedUntil) {
      return;
    }

    this.open();

    requestAnimationFrame(() => {
      if (this.destroyed || !this.externalVisible || !this.expanded) {
        return;
      }

      this.inputElement.focus({
        preventScroll: true,
      });
    });
  }

  public setVisible(visible: boolean): void {
    if (this.destroyed) {
      return;
    }

    this.externalVisible = visible;
    this.root.hidden = !visible;

    if (!visible) {
      this.inputElement.blur();
      return;
    }

    if (this.expanded) {
      this.markRead();
      this.scrollToLatest();
    }

    this.syncPresentation();
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.inputActive = false;

    this.inputElement.removeEventListener("keydown", this.handleInputKeyDown);

    this.inputElement.blur();
    this.root.remove();
  }

  private open(): void {
    if (!this.externalVisible) {
      return;
    }

    this.expanded = true;
    this.markRead();
    this.syncPresentation();
    this.scrollToLatest();
  }

  private collapse(): void {
    this.expanded = false;

    if (this.isTyping()) {
      this.reopenBlockedUntil = this.scene.time.now + CHAT_REOPEN_BLOCK_MS;
    }

    this.inputElement.blur();
    this.syncPresentation();
  }

  private readonly handleInputKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();

    if (event.key === "Enter") {
      event.preventDefault();
      this.submitMessage();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.inputElement.value = "";
      this.closeInput();
    }
  };

  private submitMessage(): void {
    const text = this.inputElement.value.trim();

    if (!text) {
      this.closeInput();
      return;
    }

    this.onSubmit(text);

    this.inputElement.value = "";

    this.closeInput();
  }

  private closeInput(): void {
    this.reopenBlockedUntil = this.scene.time.now + CHAT_REOPEN_BLOCK_MS;

    this.inputElement.blur();
  }

  private markRead(): void {
    if (this.unreadCount === 0) {
      return;
    }

    this.unreadCount = 0;
    this.syncUnreadBadge();
  }

  private syncPresentation(): void {
    this.root.hidden = !this.externalVisible;

    this.collapsedButton.hidden = this.expanded;

    this.panel.hidden = !this.expanded;

    this.collapsedButton.setAttribute("aria-expanded", String(this.expanded));
  }

  private syncUnreadBadge(): void {
    if (this.unreadCount <= 0) {
      this.unreadBadge.textContent = "";
      this.unreadBadge.hidden = true;
      return;
    }

    this.unreadBadge.textContent =
      this.unreadCount > 99 ? "99+" : String(this.unreadCount);

    this.unreadBadge.hidden = false;
  }

  private renderMessages(): void {
    this.messagesViewport.replaceChildren();

    if (this.messages.length === 0) {
      const empty = document.createElement("div");

      empty.className = "game-chat-dock__empty";

      empty.textContent = "Todavía no hay mensajes.";

      this.messagesViewport.append(empty);

      return;
    }

    const fragment = document.createDocumentFragment();

    for (const entry of this.messages) {
      const row = document.createElement("div");

      row.className = entry.isOwn
        ? "game-chat-dock__message game-chat-dock__message--own"
        : "game-chat-dock__message";

      const sender = document.createElement("span");
      sender.className = "game-chat-dock__sender";
      sender.textContent = `${entry.message.sender.displayName}:`;

      const text = document.createElement("span");
      text.className = "game-chat-dock__message-text";
      text.textContent = entry.message.text;

      row.append(sender, document.createTextNode(" "), text);

      fragment.append(row);
    }

    this.messagesViewport.append(fragment);
  }

  private isMessagesViewportNearBottom(): boolean {
    const remaining =
      this.messagesViewport.scrollHeight -
      this.messagesViewport.scrollTop -
      this.messagesViewport.clientHeight;

    return remaining <= CHAT_SCROLL_BOTTOM_THRESHOLD_PX;
  }

  private scrollToLatest(): void {
    requestAnimationFrame(() => {
      if (this.destroyed) {
        return;
      }

      this.messagesViewport.scrollTop = this.messagesViewport.scrollHeight;
    });
  }
}
