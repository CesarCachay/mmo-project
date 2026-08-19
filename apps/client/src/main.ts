import Phaser from "phaser";
import "./style.css";

import { GameScene } from "./game/GameScene";
import { JoinScene } from "./game/JoinScene";

import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./game/game.constants";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  width: VIEWPORT_WIDTH,
  height: VIEWPORT_HEIGHT,

  parent: "app",

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  },

  pixelArt: true,

  dom: {
    createContainer: true,
  },

  backgroundColor: "#1e1e1e",

  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },

  scene: [JoinScene, GameScene],
};

new Phaser.Game(config);
