import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PageStage } from "../../src/components/motion/page-stage";
import { ThemeToggle } from "../../src/components/theme-toggle";
import { ActionMenu } from "../../src/components/ui/action-menu";
import { DropdownMenuItem } from "../../src/components/ui/dropdown-menu";

export function mountInterfaceProbe() {
  const node = document.createElement("div");
  node.id = "interface-probe";
  document.body.append(node);
  const root = createRoot(node);
  function Probe() {
    const [actions, setActions] = useState(0);
    return <PageStage><section data-testid="stage-group">
      <ActionMenu><DropdownMenuItem onSelect={() => setActions((n) => n + 1)}>Executar ação</DropdownMenuItem></ActionMenu>
      <output aria-label="Ações executadas">{actions}</output>
      <ThemeToggle />
    </section></PageStage>;
  }
  root.render(<Probe />);
  return { unmount() { root.unmount(); node.remove(); } };
}
