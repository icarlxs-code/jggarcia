import { createFileRoute } from "@tanstack/react-router";
import { FretePage } from "@/routes/fretes";

export const Route = createFileRoute("/despesas-frete")({
  component: () => <FretePage kind="despesa" />,
});
