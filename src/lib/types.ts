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
  /** Replacement photo (data URL). Never overwrites foto_original. */
  foto?: string;
  /** Catalog photo, or the first photo when the product has none. Kept forever. */
  foto_original?: string;
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
  tipo?: string;
  deleted_at?: string | null;
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
  /** Exit recorded with no destination and no entry into another place. */
  somente_saida?: boolean;
  /** Transfer that is recorded at the destination but does not add to its stock. */
  soma_destino?: boolean;
  /** Optional breakdown. Existing exits keep only `quantidade` as the total. */
  pallets?: number | null;
  volumes_pallet?: number | null;
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
  | "frete"
  | "requisicao";

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
  somente_saida?: boolean;
  soma_destino?: boolean;
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
  usuario?: string;
  status?: "ativo" | "inativo";
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export type ForkliftJobStatus = "em_transporte" | "concluido" | "cancelado";

export interface ForkliftDevice {
  id: string;
  operator_id: string;
  token_hash: string;
  device_name: string;
  authorized_at: string;
  revoked_at?: string | null;
  status: "ativo" | "revogado";
}

export interface ForkliftPairing {
  id: string;
  operator_id: string;
  code_hash: string;
  expires_at: string;
  used_at?: string | null;
}

export interface ForkliftJob {
  id: string;
  codigo: string;
  operator_id: string;
  operator_nome: string;
  product_id: string;
  product_nome: string;
  product_codigo: string;
  quantity: number;
  unit: string;
  origin_id: string;
  origin_nome: string;
  destination_id: string;
  destination_nome: string;
  started_at: string;
  finished_at?: string | null;
  status: ForkliftJobStatus;
  photo?: string | null;
  photo_at?: string | null;
  device_id?: string | null;
  cancel_motivo?: string | null;
  movimento_id?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForkliftLocation {
  id: string;
  job_id: string;
  operator_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  captured_at: string;
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
  pix_tipo?: string;
  pix_chave?: string;
  pix_favorecido?: string;
  pix_banco?: string;
  rubrica: string;
  data_autorizacao: string;
  observacoes: string;
  status: FreteStatus;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  created_by_nome?: string;
  deleted_at?: string | null;
  tipo?: "pagamento" | "despesa";
}

export interface RequisicaoFornecedor {
  id: string;
  numero: string;
  fornecedor: string;
  mercadoria: string;
  mercadoria_id?: string;
  mercadoria_codigo?: string;
  quantidade: number;
  valor: number;
  carregador: string;
  vendedor: string;
  assinatura_responsavel: string;
  assinatura_fornecedor: string;
  data: string;
  horario: string;
  usuario_id: string;
  usuario_nome: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export type RequisicaoInput = Omit<RequisicaoFornecedor, "id" | "numero" | "created_at" | "deleted_at">;

export type FreteInput = Omit<FretePagamento, "id" | "numero" | "created_at" | "status" | "deleted_at"> & {
  numero?: string;
  status?: FreteStatus;
};
