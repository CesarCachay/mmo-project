import Phaser from "phaser";
import "./style.css";
import { GameScene } from "./game/GameScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  width: 800,
  height: 600,

  backgroundColor: "#1e1e1e",

  scene: [GameScene],
};

new Phaser.Game(config);
