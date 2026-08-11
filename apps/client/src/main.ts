import Phaser from "phaser";
import "./style.css";

class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  create() {
    this.add.text(20, 20, "Pokemon MMO - Cesar Edition", {
      fontSize: "24px",
      color: "#ffffff",
    });

    this.add.rectangle(400, 300, 40, 40, 0x3498db);
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  width: 800,
  height: 600,

  backgroundColor: "#1e1e1e",

  scene: GameScene,
};

new Phaser.Game(config);
