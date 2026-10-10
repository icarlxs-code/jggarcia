import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getDbGen, subscribeDb } from "@/lib/store";

export function DataActivity() {
  const generation = useSyncExternalStore(subscribeDb, getDbGen, () => 0);
  const previous = useRef(generation);
  const [time, setTime] = useState("");
  useEffect(() => {
    if (previous.current === generation) return;
    previous.current = generation;
    setTime(new Date().toLocaleTimeString("pt-BR"));
  }, [generation]);
  return (
    <div className="data-activity" title={time ? `Registros atualizados às ${time}` : "Registros do sistema"}>
      <span key={generation} className={`data-activity-dot${time ? " is-updated" : ""}`} aria-hidden="true" />
      <span className="data-activity-label">{time ? `Atualizado às ${time}` : "Registros do sistema"}</span>
    </div>
  );
}
