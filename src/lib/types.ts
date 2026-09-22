export type NivelAcesso = "admin" | "operador";
export type StockAlert = "ok" | "atencao" | "baixo" | "critico";
export type MovimentoTipo = "entrada" | "saida";
export type TipoMovimentacao = "entrada" | "saida" | "transferencia" | "contagem";
export type MovimentoStatus = "registrada" | "em_transito" | "entregue";
export type LoteStatus = "ok" | "a_vencer" | "vencido";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  nivel_acesso: NivelAcesso;
  status: boolean;
  created_at: string;
}

export interface Mercadoria {
  id: string;
  codigo: string;
  nome: string;
  unidade: string;
  status: boolean;
  created_at: string;
  estoque: number;
  minimo: number;
  cor: string;
  categoria?: string;
  pavilhao_id?: string;
  pavilhao_ids?: string[];
}

export interface Destino {
  id: string;
  nome: string;
  codigo: string;
  endereco: string;
  contato: string;
  status: boolean;
  created_at: string;
  telefone?: string;
  cnpj?: string;
  email?: string;
  logo?: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
  contato: string;
  status: boolean;
}

export interface Pavilhao {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  logo?: string;
}

export interface Lote {
  id: string;
  codigo: string;
  mercadoria_id: string;
  quantidade: number;
  unidade: string;
  validade: string;
  pavilhao_id: string;
  fornecedor_id: string;
}

export interface Saida {
  id: string;
  codigo?: string;
  data: string;
  origem: string;
  mercadoria_id: string;
  quantidade: number;
  unidade: string;
  destino_id: string;
  destino_pavilhao_id?: string;
  hora_saida: string | null;
  hora_chegada: string | null;
  data_hora_saida?: string | null;
  data_hora_chegada?: string | null;
  tempo_transporte: number | null;
  usuario_id: string;
  created_at: string;
  updated_at?: string;
  tipo?: MovimentoTipo;
  tipo_movimentacao?: TipoMovimentacao;
  status?: MovimentoStatus;
  lote_codigo?: string;
  pavilhao?: string;
  pavilhao_id?: string;
  desconta_estoque?: boolean;
  operador_nome?: string;
  empilhadeira?: string;
  estoque_origem_antes?: number;
  estoque_origem_depois?: number;
  estoque_destino_antes?: number;
  estoque_destino_depois?: number;
  observacao?: string;
  mercadoria?: Pick<Mercadoria, "id" | "codigo" | "nome"> | null;
  destino?: Pick<Destino, "id" | "nome"> | null;
  usuario?: Pick<Usuario, "id" | "nome"> | null;
  deleted_at?: string | null;
}

export type AuditAcao = "cadastrou" | "editou" | "excluiu" | "ativou" | "desativou" | "login" | "reconheceu";
export type AuditEntidade =
  | "produto"
  | "entrada"
  | "saida"
  | "destino"
  | "lote"
  | "usuario"
  | "estoque"
  | "pavilhao"
  | "contagem"
  | "seguranca"
  | "fornecedor"
  | "empilhador"
  | "frete";

export interface AuditLog {
  id: string;
  created_at: string;
  usuario_id: string;
  usuario_nome: string;
  acao: AuditAcao;
  entidade: AuditEntidade;
  entidade_id: string;
  resumo: string;
  detalhe?: string;
}

export interface SaidaInput {
  data: string;
  origem: string;
  mercadoria_id: string;
  quantidade: number;
  unidade: string;
  destino_id?: string;
  destino_pavilhao_id?: string;
  hora_saida: string | null;
  hora_chegada: string | null;
  data_hora_saida?: string | null;
  data_hora_chegada?: string | null;
  tempo_transporte: number | null;
  usuario_id: string;
  tipo?: MovimentoTipo;
  tipo_movimentacao?: TipoMovimentacao;
  status?: MovimentoStatus;
  lote_codigo?: string;
  pavilhao?: string;
  pavilhao_id?: string;
  desconta_estoque?: boolean;
  operador_nome?: string;
  empilhadeira?: string;
  estoque_origem_antes?: number;
  estoque_origem_depois?: number;
  estoque_destino_antes?: number;
  estoque_destino_depois?: number;
  observacao?: string;
  permitir_negativo?: boolean;
}

export interface Contagem {
  id: string;
  created_at: string;
  data: string;
  mercadoria_id: string;
  pavilhao_id: string;
  esperado: number;
  contado: number;
  delta: number;
  unidade: string;
  motivo: string;
  observacao: string;
  usuario_id: string;
  usuario_nome: string;
  contador: string;
  deleted_at?: string | null;
}

export type AtalhoKind = "entrada" | "saida" | "transferencia";

export interface Atalho {
  id: string;
  kind: AtalhoKind;
  nome: string;
  origem_pavilhao_id?: string;
  destino_pavilhao_id?: string;
  destino_id?: string;
  mercadoria_id?: string;
  created_at: string;
  updated_at?: string;
  usos: number;
  deleted_at?: string | null;
}

export interface Empilhador {
  id: string;
  nome: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export type FreteStatus = "rascunho" | "gerado";

export interface FretePagamento {
  id: string;
  numero: string;
  fornecedor: string;
  numero_bilhete: string;
  valor: number;
  data_entrada: string;
  pavilhao: string;
  placa: string;
  motorista: string;
  cpf: string;
  assinatura_motorista: string;
  forma_pagamento: string;
  rubrica: string;
  data_autorizacao: string;
  observacoes: string;
  status: FreteStatus;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  created_by_nome?: string;
  deleted_at?: string | null;
}

export type FreteInput = Omit<FretePagamento, "id" | "numero" | "created_at" | "status" | "deleted_at"> & {
  numero?: string;
  status?: FreteStatus;
};
