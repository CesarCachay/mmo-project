import Phaser from "phaser";
import "./style.css";

import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "@cesar-mmo/shared";

import { GameScene } from "./game/GameScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  width: VIEWPORT_WIDTH,
  height: VIEWPORT_HEIGHT,

  backgroundColor: "#1e1e1e",

  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },

  scene: [GameScene],
};

new Phaser.Game(config);
