type FlowEvent = {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
  currentTarget: HTMLElement;
  nativeEvent: { isComposing?: boolean };
};

function nextStep(from: HTMLElement) {
  const root = from.closest("[data-flow]");
  const step = Number(from.dataset.step);
  if (!root || !Number.isFinite(step)) return null;
  return [...root.querySelectorAll<HTMLElement>("[data-step]")]
    .map((node) => ({ node, step: Number(node.dataset.step) }))
    .filter((item) => item.step > step && !item.node.hasAttribute("disabled") && item.node.dataset.stepSkip !== "1")
    .sort((a, b) => a.step - b.step)[0]?.node ?? null;
}

function openIfSelect(node: HTMLElement) {
  if (node.dataset.openSelect !== "1") return;
  window.setTimeout(() => node.click(), 40);
}

function focusNode(node: HTMLElement) {
  const inner = node.matches("input, textarea, button, select, [role='combobox']")
    ? node
    : node.querySelector<HTMLElement>("[aria-pressed='true'], button, input, [role='combobox']");
  const target = inner ?? node;
  target.focus();
  openIfSelect(target);
}

export function enterNext(event: FlowEvent) {
  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return false;
  const next = nextStep(event.currentTarget);
  if (!next) return false;
  event.preventDefault();
  event.stopPropagation();
  focusNode(next);
  return true;
}

export function focusFlow(from: HTMLElement | null, step: number) {
  const root = from?.closest("[data-flow]") ?? document.querySelector("[data-flow]");
  const node = root?.querySelector<HTMLElement>(`[data-step="${step}"]`);
  if (!node || node.dataset.stepSkip === "1") return;
  focusNode(node);
}
