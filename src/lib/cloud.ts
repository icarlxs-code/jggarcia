import { createServerFn } from "@tanstack/react-start";
import type { Atalho, AuditLog, Contagem, Destino, Fornecedor, Lote, Mercadoria, Pavilhao, Saida, Usuario } from "./types";

export type CloudPayload = {
  usuarios: Usuario[];
  mercadorias: Mercadoria[];
  destinos: Destino[];
  fornecedores: Fornecedor[];
  pavilhoes: Pavilhao[];
  lotes: Lote[];
  saidas: Saida[];
  logs: AuditLog[];
  contagens: Contagem[];
  contadores?: string[];
  atalhos?: Atalho[];
  operadores?: string[];
  empilhadeiras?: string[];
  stockResetAt?: string | null;
};

export const pullCloudStore = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const { pullPayload } = await import("./cloud-store.server");
    return pullPayload();
  });

export const pushCloudStore = createServerFn({ method: "POST" })
  .validator((d: { payload: CloudPayload }) => d)
  .handler(async ({ data }) => {
    const { pushPayload } = await import("./cloud-store.server");
    return pushPayload(data.payload);
  });
