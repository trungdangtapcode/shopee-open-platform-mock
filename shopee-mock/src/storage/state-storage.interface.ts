import { MockDatabase } from "../schemas";

export interface StateStorage {
  readonly db: MockDatabase;
  load(): void;
  save(): void;
  reset(): void;
  nextOrderCounter(): number;
}
