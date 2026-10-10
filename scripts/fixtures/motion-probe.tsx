import { createRoot } from "react-dom/client";
import { CountUp } from "../../src/components/motion/count-up";
import { useRowUpdates } from "../../src/lib/use-row-updates";

export function mountProbe() {
  const host = document.createElement("div");
  host.id = "motion-probe";
  document.body.append(host);
  const root = createRoot(host);
  function Probe({ value, decimals, rows }: { value: number; decimals: number; rows: { id: string; quantity: number }[] }) {
    const changed = useRowUpdates(rows);
    return <><CountUp value={value} decimals={decimals} /><span id="row-change">{[...changed].join(",")}</span></>;
  }
  return {
    render(value: number, decimals = 0, rows = [{ id: "a", quantity: 1 }]) { root.render(<Probe value={value} decimals={decimals} rows={rows} />); },
    unmount() { root.unmount(); host.remove(); },
  };
}
