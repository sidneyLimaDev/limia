import type { LimiaApi } from "./types";

declare global {
  interface Window { limia: LimiaApi; }
}

export {};
