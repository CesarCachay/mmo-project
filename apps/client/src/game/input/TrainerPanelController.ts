/**
 * Compatibility re-export.
 *
 * TrainerPanelController lives in ../ui. Keep this file as a thin shim so
 * older imports from game/input continue to compile without maintaining a
 * second divergent implementation.
 */
export {
  TrainerPanelController,
  type TrainerPanelControllerOptions,
  type TrainerPanelSurface,
} from "../ui/TrainerPanelController";
