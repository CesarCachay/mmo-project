import type { AccountTrainer } from "./trainer-http.client";

export class SelectedTrainerStore {
  private selectedTrainer: AccountTrainer | undefined;

  select(trainer: AccountTrainer): void {
    this.selectedTrainer = trainer;
  }

  getSelected(): AccountTrainer | undefined {
    return this.selectedTrainer;
  }

  clear(): void {
    this.selectedTrainer = undefined;
  }
}

export const selectedTrainerStore = new SelectedTrainerStore();
