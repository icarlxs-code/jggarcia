import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/destinos")({
  component: () => <Navigate to="/clientes" />,
});
