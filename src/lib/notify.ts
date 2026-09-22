import { toast } from "sonner";

export const notify = {
  success(message: string, opts?: { action?: { label: string; onClick: () => void } }) {
    toast.success(message, opts?.action ? { action: { label: opts.action.label, onClick: opts.action.onClick } } : undefined);
  },
  error(message: string) {
    toast.error(message);
  },
  warning(message: string) {
    toast.warning(message);
  },
  info(message: string) {
    toast(message);
  },
};
