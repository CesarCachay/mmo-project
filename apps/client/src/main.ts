import Phaser from "phaser";
import "./style.css";
//
import "./styles/auth-shell.css";
import "./styles/account-login-scene.css";
import "./styles/trainer-selection-scene.css";
import "./styles/game-ui-responsive.css";
import "./styles/game-stage-widescreen.css";

// ui
import "./game/battle/ui/modern/battle-ui.css";
import "./game/battle/ui/modern/animations.css";
import "./game/battle/ui/modern/items.css";
import "./game/battle/ui/modern/progression.css";
import "./game/battle/ui/modern/evolution.css";
import "./game/battle/ui/modern/battle-shell-compat.css";
import "./game/storage/ui/pokemon-storage-ui.css";
import "./game/ui/interaction-prompt.css";
import "./game/ui/trainer-drawer.css";

import { GameScene } from "./game/GameScene";
import { AccountLoginScene } from "./game/AccountLoginScene";
import { TrainerSelectionScene } from "./game/TrainerSelectionScene";
import { AccountRegisterScene } from "./game/AccountRegisterScene";

import { initializeAccountShell } from "./account/account-shell.controller";
import { initializeGameShell } from "./shell/GameShellController";

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

  scene: [AccountLoginScene, AccountRegisterScene, TrainerSelectionScene, GameScene],
};

initializeGameShell();
initializeAccountShell();

new Phaser.Game(config);
