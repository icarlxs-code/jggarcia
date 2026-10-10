import { createServerFn } from "@tanstack/react-start";
import type { Atalho, AuditLog, Contagem, Destino, Empilhador, ForkliftDevice, ForkliftJob, ForkliftLocation, ForkliftPairing, Fornecedor, FretePagamento, Lote, Mercadoria, Pavilhao, RequisicaoFornecedor, Saida, Usuario } from "./types";

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
  empilhadoresPessoas?: Empilhador[];
  forkliftDevices?: ForkliftDevice[];
  forkliftPairings?: ForkliftPairing[];
  forkliftJobs?: ForkliftJob[];
  forkliftLocations?: ForkliftLocation[];
  fretes?: FretePagamento[];
  requisicoes?: RequisicaoFornecedor[];
  requisicaoSeq?: number;
  stockResetAt?: string | null;
  stockIgnoredDates?: string[];
  stockBackups?: {
    id: string;
    created_at: string;
    mode: "all" | "day";
    date?: string;
    stockResetAt: string | null;
    stockIgnoredDates: string[];
    mercadorias: { id: string; estoque: number }[];
    lotes: { id: string; quantidade: number }[];
    usuario_nome: string;
    restored_at?: string | null;
  }[];
  fechamentos?: { data: string; pos: [string, string, number][]; publicado?: [string, string, number][]; manual?: boolean; aberto?: boolean; updated_at?: string; loja?: boolean }[];
  pavilionResets?: {
    id: string;
    created_at: string;
    data: string;
    pavilhao_id: string;
    pavilhao_codigo: string;
    usuario_id: string;
    usuario_nome: string;
    itens: { mercadoria_id: string; codigo: string; nome: string; unidade: string; quantidade: number }[];
  }[];
  autoZeros?: {
    id: string;
    pavilhao_codigo: string;
    ativo: boolean;
    modo: "todo_dia" | "dias";
    dias: number[];
    updated_at: string;
    ultimo_dia?: string;
  }[];
};

export const databaseUsage = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const { guardRequest } = await import("./request-guard.server");
    await guardRequest();
    const { requireActiveSession } = await import("./auth-store.server");
    await requireActiveSession();
    const { databaseUsage: read } = await import("./cloud-store.server");
    return read();
  });

export const pullCloudStore = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const { guardRequest } = await import("./request-guard.server");
    await guardRequest();
    const { requireActiveSession } = await import("./auth-store.server");
    await requireActiveSession();
    const { pullPayload } = await import("./cloud-store.server");
    return pullPayload();
  });

export const pushCloudStore = createServerFn({ method: "POST" })
  .validator((d: { payload: CloudPayload }) => d)
  .handler(async ({ data }) => {
    const { guardRequest } = await import("./request-guard.server");
    await guardRequest();
    const { requireActiveSession } = await import("./auth-store.server");
    await requireActiveSession();
    const { pushPayload } = await import("./cloud-store.server");
    return pushPayload(data.payload);
  });
