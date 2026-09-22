import Fuse from "fuse.js";
import type { Mercadoria } from "./types";
import { db, stockAlert } from "./store";
import { fold } from "./utils";
import { formatNumber } from "./format";
import { tipoMovLabel, tipoMovimentacaoOf } from "./movement";
import { destinoDaSaida, lugarDaSaida } from "./catalog";

export type SearchKind = "pagina" | "acao" | "produto" | "lote" | "destino" | "fornecedor" | "pavilhao" | "alerta" | "comando" | "movimento" | "usuario";

export interface StockPos {
  nome: string;
  quantidade: number;
}

export interface SearchHit {
  id: string;
  kind: SearchKind;
  title: string;
  hint?: string;
  to: string;
  group: string;
  codigo?: string;
  unidade?: string;
  total?: number;
  positions?: StockPos[];
  run?: "theme" | "logout";
}

export const PAGES: SearchHit[] = [
  { id: "p-home", kind: "pagina", title: "Visão geral", hint: "Dashboard", to: "/", group: "Páginas" },
  { id: "p-hoje", kind: "pagina", title: "Hoje", hint: "Atalhos e movimento da tarde", to: "/hoje", group: "Páginas" },
  { id: "p-ent", kind: "pagina", title: "Entradas", hint: "Chegada do Ceasa", to: "/entradas", group: "Páginas" },
  { id: "p-sai", kind: "pagina", title: "Saídas", hint: "Expedição", to: "/historico", group: "Páginas" },
  { id: "p-mov", kind: "pagina", title: "Movimentações", hint: "Entradas, saídas e transferências", to: "/movimentacoes", group: "Páginas" },
  { id: "p-est", kind: "pagina", title: "Estoque", hint: "Posição atual", to: "/estoque", group: "Páginas" },
  { id: "p-cnt", kind: "pagina", title: "Contagem", hint: "Conferir pavilhão", to: "/contagem", group: "Páginas" },
  { id: "p-prod", kind: "pagina", title: "Produtos", to: "/mercadorias", group: "Páginas" },
  { id: "p-cli", kind: "pagina", title: "Clientes", hint: "Ficha, logo e ranking", to: "/clientes", group: "Páginas" },
  { id: "p-forn", kind: "pagina", title: "Fornecedores", to: "/fornecedores", group: "Páginas" },
  { id: "p-emp", kind: "pagina", title: "Empilhadores", hint: "Cadastro de nomes", to: "/empilhadores", group: "Páginas" },
  { id: "p-pav", kind: "pagina", title: "Pavilhões", to: "/pavilhoes", group: "Páginas" },
  { id: "p-aud", kind: "pagina", title: "Log de alterações", to: "/auditoria", group: "Páginas" },
  { id: "p-rel", kind: "pagina", title: "Relatórios", to: "/relatorios", group: "Páginas" },
  { id: "p-frete", kind: "pagina", title: "Pagamento de fretes", hint: "Comprovante e PDF", to: "/fretes", group: "Páginas" },
  { id: "p-usr", kind: "pagina", title: "Equipe", to: "/usuarios", group: "Páginas" },
  { id: "p-cfg", kind: "pagina", title: "Configurações", to: "/configuracoes", group: "Páginas" },
];

export const ACTIONS: SearchHit[] = [
  { id: "a-hoje", kind: "acao", title: "Criar atalho", hint: "Rota de pavilhão ou cliente", to: "/hoje", group: "Ações" },
  { id: "a-ent", kind: "acao", title: "Registrar entrada", hint: "Chegada do Ceasa", to: "/entradas", group: "Ações" },
  { id: "a-sai", kind: "acao", title: "Registrar saída", hint: "Expedição", to: "/nova-saida", group: "Ações" },
  { id: "a-cnt", kind: "acao", title: "Nova contagem", hint: "Conferir pavilhão", to: "/contagem", group: "Ações" },
  { id: "a-frete", kind: "acao", title: "Pagamento de frete", hint: "Gerar comprovante", to: "/fretes", group: "Ações" },
  { id: "a-dest", kind: "acao", title: "Cadastrar cliente", to: "/clientes", group: "Ações" },
  { id: "a-user", kind: "acao", title: "Cadastrar usuário", to: "/usuarios", group: "Ações" },
  { id: "a-low", kind: "alerta", title: "Estoque baixo", hint: "Itens no mínimo", to: "/estoque", group: "Ações" },
  { id: "a-theme", kind: "comando", title: "Alternar modo noturno", hint: "Claro / escuro", to: "/", group: "Sistema", run: "theme" },
  { id: "a-out", kind: "comando", title: "Sair da conta", to: "/", group: "Sistema", run: "logout" },
];

function fuseOf<T>(list: T[], keys: (keyof T & string)[]) {
  return new Fuse(list, { keys, threshold: 0.38, ignoreLocation: true, minMatchCharLength: 1 });
}

function matchesFold(q: string, ...fields: (string | undefined)[]) {
  const term = fold(q);
  return fields.some((f) => f && fold(f).includes(term));
}

function productHit(m: Mercadoria): SearchHit {
  const positions = db.stockPositions(m.id).filter((p) => p.quantidade > 0);
  const posHint = positions.length
    ? positions.map((p) => `${formatNumber(p.quantidade)} ${p.nome}`).join(" · ")
    : "Sem posição";
  return {
    id: m.id,
    kind: "produto",
    title: m.nome,
    hint: posHint,
    to: `/produto/${m.id}`,
    group: "Estoque",
    codigo: m.codigo,
    unidade: m.unidade,
    total: m.estoque,
    positions: positions.map((p) => ({ nome: p.nome, quantidade: p.quantidade })),
  };
}

export function globalSearch(query: string): SearchHit[] {
  const q = query.trim();
  if (!q) {
    const alerts = db
      .listMercadorias(true)
      .filter((m) => {
        const a = stockAlert(m);
        return a === "critico" || a === "baixo" || m.estoque <= 0;
      })
      .slice(0, 5)
      .map((m) => {
        const hit = productHit(m);
        hit.group = "Atenção no estoque";
        hit.kind = "alerta";
        return hit;
      });
    return [...ACTIONS.slice(0, 5), ...alerts, ...PAGES.slice(0, 7)];
  }

  const produtos = db.listMercadorias();
  const lotes = db.listLotes();
  const destinos = db.listDestinos();
  const fornecedores = db.listFornecedores();
  const pavilhoes = db.listPavilhoes();

  const fuseProd = fuseOf<Mercadoria>(produtos, ["nome", "codigo", "categoria"]).search(q).map((r) => r.item);
  const foldedProd = produtos.filter((m) => matchesFold(q, m.nome, m.codigo, m.categoria));
  const seen = new Set<string>();
  const prodHits: SearchHit[] = [];
  for (const m of [...fuseProd, ...foldedProd]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    prodHits.push(productHit(m));
    if (prodHits.length >= 8) break;
  }

  const loteHits = fuseOf(lotes, ["codigo"]).search(q).slice(0, 4).map((r) => ({
    id: r.item.id,
    kind: "lote" as const,
    title: `Lote ${r.item.codigo}`,
    hint: r.item.validade,
    to: "/lotes",
    group: "Lotes",
  }));

  const destHits = [...fuseOf(destinos, ["nome", "codigo"]).search(q).map((r) => r.item), ...destinos.filter((d) => matchesFold(q, d.nome, d.codigo))]
    .filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i)
    .slice(0, 4)
    .map((d) => ({
      id: d.id,
      kind: "destino" as const,
      title: d.nome,
      hint: d.codigo,
      to: "/clientes",
      group: "Cadastros",
    }));

  const fornHits = fuseOf(fornecedores, ["nome"]).search(q).slice(0, 3).map((r) => ({
    id: r.item.id,
    kind: "fornecedor" as const,
    title: r.item.nome,
    to: "/fornecedores",
    group: "Cadastros",
  }));

  const pavHits = pavilhoes
    .filter((p) => matchesFold(q, p.nome, p.codigo))
    .slice(0, 4)
    .map((p) => {
      const qtd = db.listMercadorias(true).filter((m) => db.stockAt(m.id, p.id) > 0).length;
      return {
        id: p.id,
        kind: "pavilhao" as const,
        title: p.nome,
        hint: qtd ? `${qtd} produto(s) com saldo` : p.codigo,
        to: "/contagem",
        group: "Pavilhões",
      };
    });

  const userHits = db
    .listUsuarios()
    .filter((u) => matchesFold(q, u.nome, u.email))
    .slice(0, 4)
    .map((u) => ({
      id: u.id,
      kind: "usuario" as const,
      title: u.nome,
      hint: u.email,
      to: "/usuarios",
      group: "Equipe",
    }));

  const pageHits = fuseOf(PAGES, ["title", "hint"]).search(q).slice(0, 6).map((r) => r.item);
  const actionHits = fuseOf(ACTIONS, ["title", "hint"]).search(q).slice(0, 6).map((r) => r.item);

  const pavilhoesAll = db.listPavilhoes(true);
  const movHits = db
    .listSaidas()
    .filter((s) => {
      const tipo = tipoMovimentacaoOf(s);
      return matchesFold(
        q,
        s.mercadoria?.nome,
        s.mercadoria?.codigo,
        s.codigo,
        s.operador_nome,
        s.usuario?.nome,
        lugarDaSaida(pavilhoesAll, s),
        destinoDaSaida(pavilhoesAll, s),
        tipoMovLabel(tipo),
      );
    })
    .slice(0, 6)
    .map((s) => {
      const tipo = tipoMovimentacaoOf(s);
      return {
        id: s.id,
        kind: "movimento" as const,
        title: `${tipoMovLabel(tipo)} ${s.codigo ? s.codigo.replace("MOV-", "#") : ""}`.trim() + ` — ${s.mercadoria?.nome ?? "produto"}`,
        hint: `${lugarDaSaida(pavilhoesAll, s)} → ${destinoDaSaida(pavilhoesAll, s)}`,
        to: "/movimentacoes",
        group: "Movimentações",
      };
    });

  return [...prodHits, ...movHits, ...actionHits, ...pavHits, ...userHits, ...loteHits, ...destHits, ...fornHits, ...pageHits].slice(0, 28);
}
