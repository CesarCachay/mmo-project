import Phaser from "phaser";
import "./style.css";
//
import "./styles/auth-shell.css";
import "./styles/account-login-scene.css";
import "./styles/trainer-selection-scene.css";
import "./styles/game-ui-responsive.css";
import "./styles/game-stage-widescreen.css";
import "./styles/mobile-trainer-sheets.css";
import "./styles/world-loading-scene.css";
import "./styles/mobile-gameplay-ux.css";

// ui
import "./game/storage/ui/pokemon-storage-ui.css";
import "./game/ui/interaction-prompt.css";
import "./game/ui/trainer-drawer.css";
import "./game/ui/dialogue-box.css";
import "./game/ui/starter-selection-panel.css";
import "./game/mobile/virtual-joystick.css";
import "./game/mobile/mobile-action-button.css";

import { AccountLoginScene } from "./game/AccountLoginScene";
import { TrainerSelectionScene } from "./game/TrainerSelectionScene";
import { AccountRegisterScene } from "./game/AccountRegisterScene";

import { initializeAccountShell } from "./account/account-shell.controller";
import { initializeGameShell } from "./shell/GameShellController";

import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./game/game.constants";

import { WorldLoadingScene } from "./game/world/WorldLoadingScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  width: VIEWPORT_WIDTH,
  height: VIEWPORT_HEIGHT,

  parent: "app",

  scale: {
    mode: Phaser.Scale.EXPAND,
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

  scene: [
    AccountLoginScene,
    AccountRegisterScene,
    TrainerSelectionScene,
    WorldLoadingScene,
  ],
};

initializeGameShell();
initializeAccountShell();

new Phaser.Game(config);
