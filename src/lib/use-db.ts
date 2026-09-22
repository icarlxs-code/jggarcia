import { useSyncExternalStore } from "react";
import { db, getDbGen, subscribeDb } from "./store";

export function useDb() {
  useSyncExternalStore(subscribeDb, getDbGen, () => 0);
  return db;
}
