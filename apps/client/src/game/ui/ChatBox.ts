import Phaser from "phaser";

import type { ChatMessage } from "@cesar-mmo/shared";
import { CHAT_MESSAGE_MAX_LENGTH } from "@cesar-mmo/shared";

const CHAT_WIDTH = 320;
const CHAT_HEIGHT = 150;

const CHAT_PADDING = 10;
const CHAT_HEADER_HEIGHT = 24;
const CHAT_INPUT_HEIGHT = 28;
const CHAT_IDLE_FOOTER_HEIGHT = 18;

const CHAT_MESSAGE_GAP = 3;
const CHAT_MAX_HISTORY = 100;
const CHAT_REOPEN_BLOCK_MS = 150;
const CHAT_TEXT_RESOLUTION = 2;

const OWN_MESSAGE_COLOR = "#7dd3fc";
const OTHER_MESSAGE_COLOR = "#ffffff";

type ChatSubmitHandler = (text: string) => void;

type ChatEntry = {
  message: ChatMessage;
  isOwn: boolean;
};

export class ChatBox {
  private readonly scene: Phaser.Scene;

  private readonly container: Phaser.GameObjects.Container;

  private readonly messagesContainer: Phaser.GameObjects.Container;

  private readonly messages: ChatEntry[] = [];

  private readonly renderedMessages: Phaser.GameObjects.Text[] = [];

  private readonly inputElement: HTMLInputElement;

  private readonly inputDom: Phaser.GameObjects.DOMElement;

  private readonly idleHint: Phaser.GameObjects.Text;

  private readonly scrollHint: Phaser.GameObjects.Text;

  private readonly onSubmit: ChatSubmitHandler;

  private readonly x: number;
  private readonly y: number;

  private inputActive = false;

  private chatVisible = true;

  /**
   * 0 = newest messages.
   * 1 = skip newest message and look one message back.
   * 2 = two messages back, etc.
   */
  private scrollOffset = 0;

  /**
   * Prevents the Enter used to submit / close the input
   * from immediately reopening it through GameScene.
   */
  private reopenBlockedUntil = 0;

  constructor(scene: Phaser.Scene, onSubmit: ChatSubmitHandler) {
    this.scene = scene;
    this.onSubmit = onSubmit;

    this.x = 14;
    this.y = scene.scale.height - CHAT_HEIGHT - 14;

    this.container = scene.add
      .container(this.x, this.y)
      .setScrollFactor(0)
      .setDepth(1000);

    /* Background */
    const background = scene.add.graphics();

    background.fillStyle(0x081018, 0.58);
    background.fillRoundedRect(0, 0, CHAT_WIDTH, CHAT_HEIGHT, 8);
    background.lineStyle(1, 0xffffff, 0.18);
    background.strokeRoundedRect(0, 0, CHAT_WIDTH, CHAT_HEIGHT, 8);

    /*
     * Header
     */
    const title = scene.add
      .text(CHAT_PADDING, 7, "Chat", {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0)
      .setResolution(CHAT_TEXT_RESOLUTION);

    const headerDivider = scene.add.graphics();

    headerDivider.lineStyle(1, 0xffffff, 0.12);

    headerDivider.lineBetween(
      CHAT_PADDING,
      CHAT_HEADER_HEIGHT,
      CHAT_WIDTH - CHAT_PADDING,
      CHAT_HEADER_HEIGHT
    );

    /*
     * Messages have their own Container.
     *
     * We only render the messages that fit inside
     * the visible area, so no rendering mask is
     * necessary.
     */
    this.messagesContainer = scene.add.container(0, 0);

    /* Footer shown while input is closed */
    this.idleHint = scene.add
      .text(CHAT_WIDTH - CHAT_PADDING, CHAT_HEIGHT - 7, "Enter para escribir", {
        fontFamily: "Arial",
        fontSize: "9px",
        color: "#aab2bd",
      })
      .setOrigin(1)
      .setResolution(CHAT_TEXT_RESOLUTION);

    /* Shows when viewing older messages */
    this.scrollHint = scene.add
      .text(CHAT_PADDING, CHAT_HEIGHT - 7, "", {
        fontFamily: "Arial",
        fontSize: "9px",
        color: "#8e99a8",
      })
      .setOrigin(0, 1)
      .setVisible(false)
      .setResolution(CHAT_TEXT_RESOLUTION);

    this.container.add([
      background,
      title,
      headerDivider,
      this.messagesContainer,
      this.idleHint,
      this.scrollHint,
    ]);

    /* HTML input */
    this.inputElement = document.createElement("input");
    this.inputElement.type = "text";
    this.inputElement.placeholder = "Escribe un mensaje...";
    this.inputElement.maxLength = CHAT_MESSAGE_MAX_LENGTH;

    Object.assign(this.inputElement.style, {
      width: `${CHAT_WIDTH - CHAT_PADDING * 2}px`,
      height: `${CHAT_INPUT_HEIGHT}px`,
      boxSizing: "border-box",
      border: "1px solid rgba(255,255,255,0.28)",
      borderRadius: "6px",
      background: "rgba(5, 10, 16, 0.94)",
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: "11px",
      padding: "5px 8px",
      outline: "none",
      boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    });

    this.inputElement.addEventListener("focus", () => {
      this.inputElement.style.borderColor = OWN_MESSAGE_COLOR;
    });

    this.inputElement.addEventListener("blur", () => {
      this.inputElement.style.borderColor = "rgba(255,255,255,0.28)";
    });

    this.inputElement.addEventListener("keydown", this.handleInputKeyDown);

    this.inputDom = scene.add
      .dom(
        this.x + CHAT_PADDING,
        this.y + CHAT_HEIGHT - CHAT_INPUT_HEIGHT - CHAT_PADDING,
        this.inputElement
      )
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1001)
      .setVisible(false);

    /* Phaser emits the Scene input "wheel" event with deltaY */
    scene.input.on("wheel", this.handleWheel);

    this.renderMessages();
  }

  addMessage(message: ChatMessage, isOwn: boolean): void {
    this.messages.push({
      message,
      isOwn,
    });

    /*
     * Keep real history instead of deleting messages
     * just because they don't fit on-screen.
     */
    if (this.messages.length > CHAT_MAX_HISTORY) {
      const excess = this.messages.length - CHAT_MAX_HISTORY;
      this.messages.splice(0, excess);
    }

    /*
     * If the user was viewing the latest messages,
     * remain at the bottom when a new one arrives.
     *
     * If the user was reading history, don't force
     * them back to the newest message.
     */
    if (this.scrollOffset === 0) {
      this.renderMessages();
      return;
    }
  }

  isTyping(): boolean {
    return this.inputActive && document.activeElement === this.inputElement;
  }

  focusInput(): void {
    if (!this.chatVisible) {
      return;
    }
    if (this.inputActive) {
      return;
    }
    if (this.scene.time.now < this.reopenBlockedUntil) {
      return;
    }

    this.inputActive = true;
    this.scrollOffset = 0;

    this.idleHint.setVisible(false);
    this.scrollHint.setVisible(false);

    this.inputDom.setVisible(true);

    this.renderMessages();

    requestAnimationFrame(() => {
      if (!this.inputActive) {
        return;
      }

      this.inputElement.focus({
        preventScroll: true,
      });
    });
  }

  setVisible(visible: boolean): void {
    this.chatVisible = visible;

    this.container.setVisible(visible);

    if (!visible) {
      this.inputActive = false;
      this.inputElement.blur();
      this.inputDom.setVisible(false);
      return;
    }

    this.inputDom.setVisible(this.inputActive);
    this.idleHint.setVisible(!this.inputActive);
    this.renderMessages();
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

    /* Enter on an empty input also closes the input */
    if (!text) {
      this.closeInput();

      return;
    }

    this.onSubmit(text);

    this.inputElement.value = "";

    this.closeInput();
  }

  private closeInput(): void {
    this.inputActive = false;

    /* Block the same Enter press from reopening the input through GameScene */
    this.reopenBlockedUntil = this.scene.time.now + CHAT_REOPEN_BLOCK_MS;

    this.inputElement.blur();

    this.inputDom.setVisible(false);

    if (this.chatVisible) {
      this.idleHint.setVisible(true);
    }

    this.scrollOffset = 0;

    this.renderMessages();
  }

  private readonly handleWheel = (
    pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number
  ): void => {
    if (!this.chatVisible) {
      return;
    }

    /* Pointer coordinates are viewport coordinates */
    const isOverChat =
      pointer.x >= this.x &&
      pointer.x <= this.x + CHAT_WIDTH &&
      pointer.y >= this.y &&
      pointer.y <= this.y + CHAT_HEIGHT;

    if (!isOverChat) {
      return;
    }

    if (this.messages.length <= 1) {
      return;
    }

    if (deltaY < 0) {
      /* Wheel up = older messages */
      this.scrollOffset = Math.min(this.scrollOffset + 1, this.messages.length - 1);
    } else if (deltaY > 0) {
      /* Wheel down = newer messages */
      this.scrollOffset = Math.max(this.scrollOffset - 1, 0);
    }

    this.renderMessages();
  };

  private getMessageAreaTop(): number {
    return CHAT_HEADER_HEIGHT + CHAT_PADDING;
  }

  private getMessageAreaBottom(): number {
    const footerHeight = this.inputActive
      ? CHAT_INPUT_HEIGHT + CHAT_PADDING
      : CHAT_IDLE_FOOTER_HEIGHT;

    return CHAT_HEIGHT - footerHeight - CHAT_PADDING;
  }

  private renderMessages(): void {
    this.clearRenderedMessages();

    if (this.messages.length === 0) {
      return;
    }

    const top = this.getMessageAreaTop();
    let currentBottom = this.getMessageAreaBottom();

    /*
     * Start from newest visible message.
     *
     * scrollOffset = 0:
     * last message
     *
     * scrollOffset = 3:
     * skip the three newest messages.
     */
    let messageIndex = this.messages.length - 1 - this.scrollOffset;

    while (messageIndex >= 0) {
      const entry = this.messages[messageIndex];

      const messageText = this.scene.add
        .text(CHAT_PADDING, 0, this.formatMessage(entry.message), {
          fontFamily: "Arial",
          fontSize: "10px",

          color: entry.isOwn ? OWN_MESSAGE_COLOR : OTHER_MESSAGE_COLOR,

          lineSpacing: 2,

          wordWrap: {
            width: CHAT_WIDTH - CHAT_PADDING * 2,
          },
        })
        .setOrigin(0)
        .setResolution(CHAT_TEXT_RESOLUTION);

      const nextY = currentBottom - messageText.height;

      /*
       * This message would exceed the visible
       * message area. Destroy it and stop.
       */
      if (nextY < top) {
        messageText.destroy();

        break;
      }

      messageText.setPosition(CHAT_PADDING, nextY);
      this.messagesContainer.add(messageText);
      this.renderedMessages.push(messageText);
      currentBottom = nextY - CHAT_MESSAGE_GAP;
      messageIndex--;
    }
  }

  private clearRenderedMessages(): void {
    for (const messageText of this.renderedMessages) {
      messageText.destroy();
    }

    this.renderedMessages.length = 0;
  }

  private formatMessage(message: ChatMessage): string {
    return `${message.sender.displayName}: ${message.text}`;
  }
}
