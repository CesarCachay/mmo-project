import Phaser from "phaser";

import type { ChatMessage } from "@cesar-mmo/shared";
import { CHAT_MESSAGE_MAX_LENGTH } from "@cesar-mmo/shared";

const CHAT_WIDTH = 300;
const CHAT_HEIGHT = 120;
const CHAT_PADDING = 8;
const CHAT_TITLE_HEIGHT = 20;
const CHAT_INPUT_HEIGHT = 26;
const OWN_MESSAGE_COLOR = "#7dd3fc";
const OTHER_MESSAGE_COLOR = "#ffffff";
const CHAT_MESSAGE_GAP = 2;

type ChatSubmitHandler = (text: string) => void;

type ChatEntry = {
  message: ChatMessage;
  isOwn: boolean;
};

export class ChatBox {
  private readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly messages: ChatEntry[] = [];
  private readonly renderedMessages: Phaser.GameObjects.Text[] = [];

  private readonly inputElement: HTMLInputElement;
  private readonly onSubmit: ChatSubmitHandler;

  private readonly messageAreaHeight =
    CHAT_HEIGHT - CHAT_PADDING * 3 - CHAT_TITLE_HEIGHT - CHAT_INPUT_HEIGHT;

  constructor(scene: Phaser.Scene, onSubmit: ChatSubmitHandler) {
    this.scene = scene;
    this.onSubmit = onSubmit;

    const x = 12;
    const y = scene.scale.height - CHAT_HEIGHT - 12;

    this.container = scene.add.container(x, y).setScrollFactor(0).setDepth(1000);

    const background = scene.add
      .rectangle(0, 0, CHAT_WIDTH, CHAT_HEIGHT, 0x000000, 0.55)
      .setOrigin(0);

    const title = scene.add
      .text(CHAT_PADDING, CHAT_PADDING, "Chat", {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#ffffff",
      })
      .setOrigin(0);

    this.container.add([background, title]);

    this.inputElement = document.createElement("input");

    this.inputElement.type = "text";
    this.inputElement.placeholder = "Escribe un mensaje...";
    this.inputElement.maxLength = CHAT_MESSAGE_MAX_LENGTH;

    this.inputElement.addEventListener("focus", () => {
      this.inputElement.style.borderColor = OWN_MESSAGE_COLOR;
    });

    this.inputElement.addEventListener("blur", () => {
      this.inputElement.style.borderColor = "rgba(255, 255, 255, 0.35)";
    });

    Object.assign(this.inputElement.style, {
      width: `${CHAT_WIDTH - CHAT_PADDING * 2}px`,
      height: `${CHAT_INPUT_HEIGHT}px`,
      boxSizing: "border-box",
      border: "1px solid rgba(255, 255, 255, 0.35)",
      borderRadius: "3px",
      background: "rgba(0, 0, 0, 0.75)",
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: "11px",
      padding: "4px 6px",
      outline: "none",
    });

    scene.add
      .dom(
        x + CHAT_PADDING,
        y + CHAT_HEIGHT - CHAT_INPUT_HEIGHT - CHAT_PADDING,
        this.inputElement
      )
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1001);

    this.inputElement.addEventListener("keydown", this.handleInputKeyDown);
  }

  addMessage(message: ChatMessage, isOwn: boolean): void {
    this.messages.push({
      message,
      isOwn,
    });

    this.renderMessages();
  }
  isTyping(): boolean {
    return document.activeElement === this.inputElement;
  }

  focusInput(): void {
    this.inputElement.focus();
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
      this.inputElement.blur();
    }
  };

  private submitMessage(): void {
    const text = this.inputElement.value.trim();

    if (!text) {
      return;
    }

    this.onSubmit(text);

    this.inputElement.value = "";
    this.inputElement.blur();
  }

  private renderMessages(): void {
    let totalHeight = this.renderMessageObjects();

    while (this.messages.length > 1 && totalHeight > this.messageAreaHeight) {
      this.messages.shift();
      totalHeight = this.renderMessageObjects();
    }
  }

  private renderMessageObjects(): number {
    this.clearRenderedMessages();
    let currentY = CHAT_PADDING + CHAT_TITLE_HEIGHT;
    let totalHeight = 0;

    for (const entry of this.messages) {
      const messageText = this.scene.add
        .text(CHAT_PADDING, currentY, this.formatMessage(entry.message), {
          fontFamily: "Arial",
          fontSize: "10px",
          color: entry.isOwn ? OWN_MESSAGE_COLOR : OTHER_MESSAGE_COLOR,
          lineSpacing: 2,
          wordWrap: {
            width: CHAT_WIDTH - CHAT_PADDING * 2,
          },
        })
        .setOrigin(0);

      this.container.add(messageText);
      this.renderedMessages.push(messageText);
      currentY += messageText.height + CHAT_MESSAGE_GAP;
      totalHeight += messageText.height + CHAT_MESSAGE_GAP;
    }

    if (this.messages.length > 0) {
      totalHeight -= CHAT_MESSAGE_GAP;
    }

    return totalHeight;
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
