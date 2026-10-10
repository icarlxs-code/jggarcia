import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { db } from "@/lib/store";
import { notify } from "@/lib/notify";
import { queueEdit } from "@/lib/ctx-edit";
import { pavTitle } from "@/lib/catalog";
import { formatDateBR, formatNumber, isoDaysAgo, monthStartISO, todayISO } from "@/lib/format";
import { clientsForProduct, exportPlacePdf, exportProductFichaPdf, exportReportPdf } from "@/lib/reports";
import { isPinned, togglePin } from "@/lib/pins";
import { useSession } from "@/lib/session";
import { ProductIcon } from "@/components/inventory/product-icon";
import { cn } from "@/lib/utils";

type Hit = {
  kind: string;
  part: string;
  id: string;
  nome: string;
  codigo: string;
  pav: string;
  extra: string;
  produto: string;
  qtd: string;
};

type Node = {
  id: string;
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: string;
  shortcut?: string;
  run?: () => void | Promise<void>;
  children?: Node[];
};

type Group = { title?: string; items: Node[] };

const RECENT_KEY = "jg-ctx-recent";

function readHit(target: EventTarget | null): Hit | null {
  const el = target instanceof Element ? target : null;
  if (!el) return null;
  const partEl = el.closest<HTMLElement>("[data-part]");
  const ctxEl = el.closest<HTMLElement>("[data-ctx]");
  if (!ctxEl) return partEl ? null : null;
  const partInside = partEl && ctxEl.contains(partEl) ? partEl.dataset.part || "" : "";
  return {
    kind: ctxEl.dataset.ctx || "",
    part: partInside,
    id: ctxEl.dataset.id || "",
    nome: ctxEl.dataset.nome || "",
    codigo: ctxEl.dataset.codigo || "",
    pav: ctxEl.dataset.pav || partEl?.dataset.id || "",
    extra: ctxEl.dataset.extra || "",
    produto: ctxEl.dataset.produto || "",
    qtd: ctxEl.dataset.qtd || partEl?.dataset.qtd || "",
  };
}

async function copyText(text: string, ok = "Copiado.") {
  const value = text.trim();
  if (!value) {
    notify.error("Nada para copiar.");
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    notify.success(ok);
  } catch {
    notify.error("O navegador bloqueou a cópia.");
  }
}

function remember(label: string, href: string) {
  try {
    const prev = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as { label: string; href: string }[];
    const next = [{ label, href }, ...prev.filter((x) => x.href !== href)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function AppContextMenu() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { perfil, isAdmin } = useSession();
  const [menu, setMenu] = useState<{ x: number; y: number; groups: Group[]; title: string } | null>(null);
  const [sub, setSub] = useState<{ id: string; items: Node[]; x: number; y: number } | null>(null);
  const [focus, setFocus] = useState(0);
  const [rename, setRename] = useState<{ id: string; nome: string } | null>(null);
  const [panel, setPanel] = useState<
    | null
    | { type: "produto"; id: string }
    | { type: "saldo"; id: string }
    | { type: "transfer"; id: string; origem: string }
    | { type: "confirm"; title: string; lines: string[]; run: () => void }
    | { type: "quem"; title: string; subtitle: string; rows: { nome: string; qtd: string }[] }
  >(null);
  const [transferQty, setTransferQty] = useState("");
  const [transferDest, setTransferDest] = useState("");
  const originRef = useRef<HTMLElement | null>(null);
  const flat = useMemo(() => menu?.groups.flatMap((g) => g.items) ?? [], [menu]);

  function close() {
    setMenu(null);
    setSub(null);
    const back = originRef.current;
    originRef.current = null;
    back?.focus?.();
  }

  function go(to: string, search?: Record<string, string>) {
    remember(to, search ? `${to}?${new URLSearchParams(search)}` : to);
    close();
    void navigate({ to, search });
  }

  function openAt(x: number, y: number, groups: Group[], title: string, origin: HTMLElement | null) {
    originRef.current = origin;
    const width = 280;
    const height = Math.min(window.innerHeight - 16, groups.reduce((n, g) => n + g.items.length * 36 + 22, 28));
    setMenu({
      x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
      groups,
      title,
    });
    setSub(null);
    setFocus(0);
  }

  function build(hit: Hit | null, selected: string): Group[] {
    const groups: Group[] = [];
    const produtoId = hit?.kind === "produto" ? hit.id : hit?.produto || "";
    const merc = produtoId ? db.listMercadorias(true).find((m) => m.id === produtoId) : undefined;
    const pavs = db.listPavilhoes();

    const copyNodes = (lines: { label: string; text: string }[]): Node => ({
      id: "copiar",
      label: "Copiar",
      children: lines.filter((l) => l.text.trim()).map((l) => ({ id: `copy-${l.label}`, label: l.label, run: () => copyText(l.text, `${l.label} copiado.`) })),
    });

    if (hit?.kind === "produto" && merc) {
      const positions = db.stockPositions(merc.id).filter((p) => p.quantidade > 0);
      const origem = hit.pav || positions[0]?.id || "";
      const op: Node[] = [
        { id: "entrada", label: "Registrar entrada", shortcut: "Ctrl+Shift+E", run: () => go("/entradas", { produto: merc.id, ...(origem ? { pav: origem } : {}) }) },
        { id: "saida", label: "Registrar saída", shortcut: "Ctrl+Shift+S", run: () => go("/nova-saida", { produto: merc.id, ...(origem ? { pav: origem } : {}) }) },
        { id: "contar", label: "Contar", shortcut: "Ctrl+Shift+C", run: () => go("/contagem", { produto: merc.id, ...(origem ? { pav: origem } : {}) }) },
        {
          id: "transferir",
          label: "Transferir",
          disabled: positions.length ? undefined : "Produto sem saldo para transferir.",
          children: positions.map((p) => ({
            id: `tr-${p.id}`,
            label: p.nome,
            hint: `${formatNumber(p.quantidade)} ${merc.unidade}`,
            children: pavs
              .filter((d) => d.id !== p.id)
              .map((d) => ({
                id: `td-${p.id}-${d.id}`,
                label: pavTitle(d),
                hint: `${formatNumber(db.stockAt(merc.id, d.id))} ${merc.unidade}`,
                run: () => {
                  const origemId = p.id;
                  const destinoId = d.id;
                  const produtoId = merc.id;
                  close();
                  window.setTimeout(() => {
                    setTransferDest(destinoId);
                    setTransferQty("");
                    setPanel({ type: "transfer", id: produtoId, origem: origemId });
                  }, 30);
                },
              })),
          })),
        },
      ];
      if (hit.part === "qtd" || hit.part === "codigo" || hit.part === "nome" || hit.part === "pav") {
        op.unshift({ id: "parte", label: hit.part === "qtd" ? "Quantidade" : hit.part === "codigo" ? "Código" : hit.part === "pav" ? "Local" : "Produto", disabled: "Menu deste trecho." });
      }
      groups.push({ title: hit.part === "qtd" ? "Estoque" : "Operação", items: op.filter((n) => n.id !== "parte") });
      groups.push({
        title: "Consulta",
        items: [
          { id: "perfil", label: "Abrir produto", shortcut: "Enter", run: () => go(`/produto/${merc.id}`) },
          { id: "painel", label: "Abrir em painel lateral", run: () => { setPanel({ type: "produto", id: merc.id }); close(); } },
          { id: "saldo", label: "Explicar saldo", run: () => { setPanel({ type: "saldo", id: merc.id }); close(); } },
          { id: "movs", label: "Ver movimentações", run: () => go("/movimentacoes", { q: merc.nome }) },
          { id: "pdf", label: "PDF deste produto", run: () => { close(); exportProductFichaPdf(merc.id); } },
        ],
      });
      groups.push({
        items: [
          copyNodes([
            { label: "Nome", text: merc.nome },
            { label: "Código", text: merc.codigo },
            { label: "Quantidade", text: `${merc.estoque} ${merc.unidade}` },
            { label: "Registro", text: `${merc.codigo} · ${merc.nome} · ${merc.estoque} ${merc.unidade}` },
          ]),
          {
            id: "pin",
            label: isPinned(perfil?.id, merc.id) ? "Desafixar do topo" : "Fixar no topo",
            run: () => {
              const on = togglePin(perfil?.id, merc.id);
              notify.success(on ? "Fixado no topo do estoque, só nesta conta." : "Deixou de ficar fixado.");
              close();
            },
          },
          {
            id: "editar",
            label: "Editar produto",
            shortcut: "F2",
            disabled: isAdmin ? undefined : "Só administrador altera o cadastro.",
            run: () => { queueEdit("produto", merc.id); go("/mercadorias"); },
          },
        ],
      });
    } else if (hit?.kind === "pavilhao" && hit.id) {
      groups.push({
        title: "Lugar",
        items: [
          { id: "ent", label: "Registrar entrada aqui", run: () => go("/entradas", { pav: hit.id }) },
          { id: "sai", label: "Registrar saída daqui", run: () => go("/nova-saida", { pav: hit.id }) },
          { id: "con", label: "Contar este lugar", run: () => go("/contagem", { pav: hit.id }) },
          { id: "est", label: "Ver estoque", run: () => go("/estoque") },
          { id: "pdf", label: "PDF deste lugar", run: () => { close(); exportPlacePdf(hit.id); } },
          { id: "nome", label: "Mudar nome", run: () => setRename({ id: hit.id, nome: hit.nome }) },
          {
            id: "excluir",
            label: "Excluir lugar",
            danger: true,
            disabled: isAdmin ? undefined : "Só administrador.",
            run: () => {
              setPanel({
                type: "confirm",
                title: `Excluir ${hit.nome || "lugar"}`,
                lines: ["O lugar sai das listas e dos filtros.", "O histórico antigo permanece."],
                run: () => { db.deletePavilhao(hit.id); notify.success("Lugar excluído."); },
              });
              close();
            },
          },
        ],
      });
    } else if ((hit?.kind === "saida" || hit?.kind === "entrada") && hit.id) {
      const row = db.listSaidas().find((s) => s.id === hit.id);
      groups.push({
        title: hit.kind === "entrada" ? "Entrada" : "Saída",
        items: [
          { id: "ver", label: hit.kind === "entrada" ? "Ver entradas" : "Ver saídas", run: () => go(hit.kind === "entrada" ? "/entradas" : "/historico") },
          { id: "edit", label: "Editar lançamento", disabled: hit.kind === "entrada" ? "Ajuste a quantidade na lista de entradas." : undefined, run: () => { queueEdit("saida", hit.id); go("/historico"); } },
          { id: "prod", label: "Abrir produto em painel", disabled: hit.produto ? undefined : "Este lançamento não tem produto.", run: () => { if (hit.produto) { setPanel({ type: "produto", id: hit.produto }); close(); } } },
          { id: "saldo", label: "Explicar saldo do produto", disabled: hit.produto ? undefined : "Sem produto.", run: () => { if (hit.produto) { setPanel({ type: "saldo", id: hit.produto }); close(); } } },
          copyNodes([{ label: "Lançamento", text: [hit.nome, hit.codigo, hit.extra].filter(Boolean).join(" · ") }]),
          {
            id: "estorno",
            label: "Estornar lançamento",
            danger: true,
            disabled: isAdmin ? undefined : "Só administrador estorna.",
            run: () => {
              setPanel({
                type: "confirm",
                title: "Estornar lançamento",
                lines: ["O estoque volta ao que era antes deste lançamento.", "A exclusão fica no log."],
                run: () => {
                  const snap = row ? db.deleteSaida(row.id) : db.deleteSaida(hit.id);
                  if (!snap) {
                    notify.error("Não foi possível estornar.");
                    return;
                  }
                  notify.success("Lançamento estornado.", { action: { label: "Desfazer", onClick: () => db.restoreSaida(snap) } });
                },
              });
              close();
            },
          },
        ],
      });
    } else if (hit?.kind === "rank-cliente" && hit.id) {
      groups.push({
        title: hit.nome || "Cliente",
        items: [
          { id: "pdf", label: "PDF do que retirou neste mês", run: () => { close(); exportReportPdf({ from: monthStartISO(), to: todayISO(), pavilhaoId: "todos", kind: "saida", destinoId: hit.id, destinoNome: hit.nome }); } },
          { id: "abrir", label: "Abrir ficha", run: () => go(`/clientes/${hit.id}`) },
          { id: "ver", label: "Ver saídas", run: () => go("/movimentacoes", { q: hit.nome, tipo: "saida", periodo: "tudo" }) },
        ],
      });
    } else if (hit?.kind === "rank-produto" && hit.id) {
      const saida = hit.extra !== "entrada";
      groups.push({
        title: hit.nome || "Produto",
        items: saida
          ? [
              { id: "quem", label: "Ver quem retirou", run: () => {
                const info = clientsForProduct(hit.id, monthStartISO(), todayISO());
                setPanel({
                  type: "quem",
                  title: info.produto,
                  subtitle: "Quem retirou neste mês",
                  rows: info.rank.map((r) => ({ nome: `${r.nome} · ${r.vezes} ${r.vezes === 1 ? "saída" : "saídas"}`, qtd: `${formatNumber(r.qtd)} ${info.unidade}` })),
                });
                close();
              } },
              { id: "pdf", label: "PDF das saídas deste mês", run: () => { close(); exportReportPdf({ from: monthStartISO(), to: todayISO(), pavilhaoId: "todos", kind: "saida", mercadoriaId: hit.id, produtoQuery: hit.nome }); } },
              { id: "abrir", label: "Abrir produto", run: () => go(`/produto/${hit.id}`) },
            ]
          : [
              { id: "pdf", label: "PDF das entradas deste mês", run: () => { close(); exportReportPdf({ from: monthStartISO(), to: todayISO(), pavilhaoId: "todos", kind: "entrada", mercadoriaId: hit.id, produtoQuery: hit.nome }); } },
              { id: "ver", label: "Ver entradas", run: () => go("/movimentacoes", { q: hit.nome, tipo: "entrada", periodo: "tudo" }) },
              { id: "abrir", label: "Abrir produto", run: () => go(`/produto/${hit.id}`) },
            ],
      });
    } else if (hit?.kind === "rank-cliente-produto" && hit.id && hit.produto) {
      groups.push({
        title: hit.nome || "Cliente",
        items: [
          { id: "pdf", label: "PDF deste cliente neste produto", run: () => { close(); exportReportPdf({ from: monthStartISO(), to: todayISO(), pavilhaoId: "todos", kind: "saida", destinoId: hit.id, destinoNome: hit.nome, mercadoriaId: hit.produto }); } },
          { id: "abrir", label: "Abrir ficha do cliente", run: () => go(`/clientes/${hit.id}`) },
          { id: "prod", label: "Abrir produto", run: () => go(`/produto/${hit.produto}`) },
        ],
      });
    } else if (hit?.kind === "cliente" && hit.id) {
      groups.push({
        title: "Cliente",
        items: [
          { id: "abrir", label: "Abrir ficha", run: () => go(`/clientes/${hit.id}`) },
          { id: "saida", label: "Nova saída para este cliente", run: () => go("/nova-saida", { dest: hit.id }) },
          { id: "hist", label: "Ver saídas", run: () => go("/historico") },
          copyNodes([{ label: "Nome", text: hit.nome }]),
          { id: "edit", label: "Editar", disabled: isAdmin ? undefined : "Só administrador.", run: () => { queueEdit("cliente", hit.id); if (pathname !== "/clientes") go("/clientes"); } },
        ],
      });
    } else if (hit?.kind === "fornecedor" && hit.id) {
      groups.push({
        title: "Fornecedor",
        items: [
          { id: "ent", label: "Registrar entrada", run: () => go("/entradas") },
          { id: "frete", label: "Pagamento de frete", run: () => go("/fretes") },
          { id: "despesa-frete", label: "Despesa de frete", run: () => go("/despesas-frete") },
          copyNodes([{ label: "Nome", text: hit.nome }, { label: "Contato", text: hit.extra }]),
          { id: "edit", label: "Editar", run: () => { queueEdit("fornecedor", hit.id); if (pathname !== "/fornecedores") go("/fornecedores"); } },
        ],
      });
    } else if (hit?.kind === "transporte" && hit.id) {
      let job: ReturnType<typeof db.listForkliftJobs>[number] | undefined;
      try {
        job = db.listForkliftJobs().find((j) => j.id === hit.id);
      } catch {
        job = undefined;
      }
      const openJob = (action: "abrir" | "editar") => {
        window.dispatchEvent(new CustomEvent("jg-forklift", { detail: { action, id: hit.id } }));
        if (pathname !== "/empilhadores") go("/empilhadores");
        else close();
      };
      groups.push({
        title: job?.codigo || "Transporte",
        items: [
          { id: "abrir", label: "Abrir", run: () => openJob("abrir") },
          { id: "editar", label: "Editar", disabled: isAdmin ? undefined : "Só administrador.", run: () => openJob("editar") },
          { id: "produto", label: "Abrir produto", disabled: job ? undefined : "Produto não encontrado.", run: () => job && go(`/produto/${job.product_id}`) },
          { id: "lanc", label: job?.movimento_id ? "Ver lançamento ligado" : "Ligar a entrada ou saída", run: () => openJob("editar") },
          copyNodes([
            { label: "Operação", text: job?.codigo || "" },
            { label: "Empilhador", text: job?.operator_nome || hit.nome },
            { label: "Produto", text: job ? `${job.product_nome} · ${formatNumber(job.quantity)} ${job.unit}` : "" },
            { label: "Trajeto", text: job ? `${job.origin_nome} → ${job.destination_nome}` : "" },
          ]),
          {
            id: "excluir",
            label: "Excluir transporte",
            danger: true,
            disabled: isAdmin ? undefined : "Só administrador.",
            run: () => {
              setPanel({
                type: "confirm",
                title: "Excluir transporte",
                lines: ["A foto, a localização e o registro saem da lista.", "A exclusão fica no log."],
                run: () => { db.deleteForkliftJob(hit.id); notify.success("Transporte excluído."); },
              });
              close();
            },
          },
        ],
      });
    } else if (hit?.kind === "empilhador" && hit.id) {
      const fire = (action: "vincular" | "revogar" | "excluir" | "editar") => {
        window.dispatchEvent(new CustomEvent("jg-empilhador", { detail: { action, id: hit.id } }));
        if (pathname !== "/empilhadores") go("/empilhadores");
        else close();
      };
      groups.push({
        title: "Empilhador",
        items: [
          { id: "hoje", label: "Ver transportes", run: () => { window.dispatchEvent(new CustomEvent("jg-empilhador", { detail: { action: "transportes", id: hit.id, nome: hit.nome } })); if (pathname !== "/empilhadores") go("/empilhadores"); else close(); } },
          { id: "vincular", label: "Vincular celular", disabled: isAdmin ? undefined : "Só administrador.", run: () => fire("vincular") },
          { id: "revogar", label: "Remover celular", disabled: isAdmin ? undefined : "Só administrador.", run: () => fire("revogar") },
          copyNodes([{ label: "Nome", text: hit.nome }]),
          { id: "edit", label: "Corrigir nome", disabled: isAdmin ? undefined : "Só administrador.", run: () => fire("editar") },
          { id: "excluir", label: "Excluir do cadastro", danger: true, disabled: isAdmin ? undefined : "Só administrador.", run: () => fire("excluir") },
        ],
      });
    } else if (hit?.kind === "frete" && hit.id) {
      const notes = db.listFretes();
      const ordered = notes.slice().sort((a, b) => String(a.numero_bilhete || a.numero).localeCompare(String(b.numero_bilhete || b.numero)));
      const idx = ordered.findIndex((f) => f.id === hit.id);
      const prev = idx > 0 ? ordered[idx - 1] : undefined;
      const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : undefined;
      const openFrete = (id: string) => window.dispatchEvent(new CustomEvent("jg-frete", { detail: { action: "abrir", id } }));
      groups.push({
        title: "Frete",
        items: [
          { id: "abrir", label: "Abrir comprovante", run: () => { openFrete(hit.id); if (pathname !== "/fretes") go("/fretes"); } },
          { id: "pdf", label: "Ver nota", run: () => { window.dispatchEvent(new CustomEvent("jg-frete", { detail: { action: "pdf", id: hit.id } })); if (pathname !== "/fretes") go("/fretes"); } },
          { id: "prev", label: "Bilhete anterior", disabled: prev ? undefined : "Este é o primeiro.", run: () => { if (prev) openFrete(prev.id); } },
          { id: "next", label: "Próximo bilhete", disabled: next ? undefined : "Este é o último.", run: () => { if (next) openFrete(next.id); } },
          copyNodes([{ label: "Número", text: hit.extra || hit.codigo }, { label: "Fornecedor", text: hit.nome }]),
          {
            id: "excluir",
            label: "Excluir nota",
            danger: true,
            run: () => {
              setPanel({
                type: "confirm",
                title: "Excluir nota de frete",
                lines: ["A nota sai da lista e a exclusão fica no log."],
                run: () => { db.deleteFrete(hit.id); notify.success("Nota excluída."); },
              });
              close();
            },
          },
        ],
      });
    } else if (hit?.kind === "kpi") {
      const map: Record<string, Node[]> = {
        skus: [
          { id: "prod", label: "Abrir produtos", run: () => go("/mercadorias") },
          { id: "est", label: "Abrir estoque", run: () => go("/estoque") },
        ],
        estoque: [
          { id: "est", label: "Estoque completo", run: () => go("/estoque") },
          { id: "pav", label: "Por lugar", run: () => go("/pavilhoes") },
        ],
        entradas: [
          { id: "ver", label: "Ver entradas", run: () => go("/entradas") },
          { id: "nova", label: "Nova entrada", run: () => go("/entradas") },
        ],
        saidas: [
          { id: "ver", label: "Ver saídas", run: () => go("/historico") },
          { id: "nova", label: "Nova saída", run: () => go("/nova-saida") },
        ],
        critico: [
          { id: "est", label: "Abrir estoque", run: () => go("/estoque") },
          { id: "con", label: "Iniciar contagem", run: () => go("/contagem") },
        ],
        grafico: [
          { id: "mov", label: "Ver estas movimentações", run: () => go("/movimentacoes", { periodo: "7d" }) },
          { id: "in", label: "Só entradas", run: () => go("/movimentacoes", { periodo: "7d", tipo: "entrada" }) },
          { id: "out", label: "Só saídas", run: () => go("/movimentacoes", { periodo: "7d", tipo: "saida" }) },
          { id: "pdf", label: "PDF destes 7 dias", run: () => { close(); exportReportPdf({ from: isoDaysAgo(6), to: todayISO(), pavilhaoId: "todos", kind: "tudo" }); } },
        ],
      };
      const items = map[hit.id];
      if (items?.length) groups.push({ title: hit.nome || "Painel", items });
    }

    if (selected) groups.push({ items: [{ id: "sel", label: "Copiar seleção", run: () => copyText(selected, "Seleção copiada.") }] });
    return groups.map((g) => ({ ...g, items: g.items.filter((item) => item.id !== "copiar" || (item.children && item.children.length > 0)) }));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && !!e.target.closest("input, textarea, select, [contenteditable='true']");
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !typing) {
        const k = e.key.toLowerCase();
        if (k === "e") { e.preventDefault(); go("/entradas"); return; }
        if (k === "s") { e.preventDefault(); go("/nova-saida"); return; }
        if (k === "c") { e.preventDefault(); go("/contagem"); return; }
        if (k === "t") { e.preventDefault(); go("/nova-saida"); return; }
      }
      if (!menu) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setFocus((i) => Math.min(flat.length - 1, i + 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setFocus((i) => Math.max(0, i - 1)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = flat[focus];
        if (!item || item.disabled) return;
        if (item.children?.length) setSub({ id: item.id, items: item.children, x: (menu?.x || 0) + 272, y: menu?.y || 0 });
        else void item.run?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    let hold = 0;
    let sx = 0;
    let sy = 0;
    function onMenu(e: MouseEvent) {
      const target = e.target instanceof Element ? e.target : null;
      if (!target || target.closest("[data-ctx-menu='true']")) return;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      const hit = readHit(target);
      const selected = window.getSelection()?.toString().trim() || "";
      const groups = build(hit, selected);
      if (!groups.some((g) => g.items.length)) return;
      e.preventDefault();
      openAt(e.clientX, e.clientY, groups, hit?.nome || titleFor(pathname), target as HTMLElement);
    }
    function start(e: TouchEvent) {
      const t = e.target instanceof Element ? e.target : null;
      if (!t || t.closest("input, textarea, select")) return;
      const touch = e.touches[0];
      sx = touch.clientX;
      sy = touch.clientY;
      hold = window.setTimeout(() => {
        const hit = readHit(t);
        const groups = build(hit, "");
        if (!hit || !groups.some((g) => g.items.length)) return;
        openAt(sx, sy, groups, hit.nome || titleFor(pathname), t as HTMLElement);
      }, 520);
    }
    function move(e: TouchEvent) {
      const touch = e.touches[0];
      if (!touch || Math.abs(touch.clientX - sx) + Math.abs(touch.clientY - sy) > 12) window.clearTimeout(hold);
    }
    function end() { window.clearTimeout(hold); }
    document.addEventListener("contextmenu", onMenu);
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", end);
    return () => {
      document.removeEventListener("contextmenu", onMenu);
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
    };
  });

  function saveName() {
    if (!rename) return;
    const nome = rename.nome.trim();
    if (!nome) { notify.error("Escreva o nome do lugar."); return; }
    db.updatePavilhao(rename.id, { nome });
    notify.success("Nome alterado no sistema.");
    setRename(null);
  }

  function confirmTransfer() {
    if (panel?.type !== "transfer") return;
    const qtd = Number(transferQty);
    const merc = db.listMercadorias(true).find((m) => m.id === panel.id);
    if (!merc || !qtd || qtd <= 0) { notify.error("Informe a quantidade."); return; }
    if (!transferDest || transferDest === panel.origem) { notify.error("Escolha outro lugar."); return; }
    const disponivel = db.stockAt(merc.id, panel.origem);
    if (qtd > disponivel) { notify.error(`Neste lugar só tem ${formatNumber(disponivel)} ${merc.unidade}.`); return; }
    const twin = db.listSaidas().find((s) => s.mercadoria_id === merc.id && s.pavilhao_id === panel.origem && s.destino_pavilhao_id === transferDest && s.quantidade === qtd && Date.now() - new Date(s.created_at).getTime() < 35000);
    if (twin && !window.confirm("Existe uma transferência igual há poucos segundos. Continuar mesmo assim?")) return;
    try {
      db.createSaida({
        data: todayISO(),
        origem: pavsNome(panel.origem),
        mercadoria_id: merc.id,
        quantidade: qtd,
        unidade: merc.unidade,
        destino_pavilhao_id: transferDest,
        pavilhao_id: panel.origem,
        hora_saida: new Date().toISOString().slice(11, 16),
        hora_chegada: new Date().toISOString().slice(11, 16),
        tempo_transporte: 0,
        usuario_id: perfil?.id || "",
        tipo: "saida",
        desconta_estoque: true,
        observacao: "Transferência pelo menu contextual",
      });
      notify.success(`${formatNumber(qtd)} ${merc.unidade} transferidos.`);
      setPanel(null);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível transferir.");
    }
  }

  const transferMerc = panel?.type === "transfer" ? db.listMercadorias(true).find((m) => m.id === panel.id) : undefined;
  const saldoMerc = panel?.type === "saldo" || panel?.type === "produto" ? db.listMercadorias(true).find((m) => m.id === panel.id) : undefined;

  return (
    <>
      {menu ? (
        <div data-ctx-menu="true" className="fixed inset-0 z-[80]" onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }}>
          <div role="menu" className="fixed max-h-[min(32rem,calc(100vh-1rem))] w-[17.5rem] overflow-y-auto rounded-xl border border-border bg-card py-1 text-card-foreground shadow-card" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
            {sub ? (
              <>
                <button type="button" className="flex h-9 w-full items-center px-3 text-left text-sm font-medium text-muted-foreground hover:bg-muted" onClick={() => setSub(null)}>
                  ‹ Voltar
                </button>
                <MenuList
                  nodes={sub.items}
                  focus={-1}
                  onOpenSub={(item) => {
                    if (!item.children?.length) return;
                    setSub({ id: item.id, items: item.children, x: menu.x, y: menu.y });
                  }}
                />
              </>
            ) : (
              <>
                <p className="truncate px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{menu.title}</p>
                {menu.groups.map((group, gi) => {
                  const start = menu.groups.slice(0, gi).reduce((n, g) => n + g.items.length, 0);
                  return (
                    <div key={`${group.title || "g"}-${gi}`}>
                      {group.title ? <p className="px-3 pb-0.5 pt-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p> : null}
                      <MenuList
                        nodes={group.items}
                        focus={focus - start}
                        onHover={(i) => setFocus(start + i)}
                        onOpenSub={(item) => {
                          if (!item.children?.length) return;
                          setSub({ id: item.id, items: item.children, x: menu.x, y: menu.y });
                        }}
                      />
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      ) : null}

      {panel?.type === "produto" && saldoMerc ? (
        <aside data-ctx-menu="true" className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-sm flex-col border-l border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Produto</p>
            <button type="button" className="text-sm text-muted-foreground" onClick={() => setPanel(null)}>Fechar</button>
          </div>
          <div className="space-y-3 overflow-y-auto p-4">
            <div className="flex items-center gap-3">
              <ProductIcon nome={saldoMerc.nome} codigo={saldoMerc.codigo} size="md" />
              <div>
                <p className="font-mono text-xs font-bold">{saldoMerc.codigo}</p>
                <p className="font-medium">{saldoMerc.nome}</p>
                <p className="text-sm tabular-nums">{formatNumber(saldoMerc.estoque)} {saldoMerc.unidade}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {db.stockPositions(saldoMerc.id).filter((p) => p.quantidade > 0).map((p) => (
                <span key={p.id} className="rounded-md border border-border px-2 py-1 text-xs">{p.nome}: {formatNumber(p.quantidade)}</span>
              ))}
            </div>
            <button type="button" className="text-sm font-medium underline" onClick={() => go(`/produto/${saldoMerc.id}`)}>Abrir ficha</button>
          </div>
        </aside>
      ) : null}

      {panel?.type === "saldo" && saldoMerc ? (
        <div data-ctx-menu="true" className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4" onClick={() => setPanel(null)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <SaldoBox id={saldoMerc.id} nome={saldoMerc.nome} unidade={saldoMerc.unidade} atual={saldoMerc.estoque} />
            <button type="button" className="mt-3 h-9 rounded-lg border border-border px-3 text-sm" onClick={() => setPanel(null)}>Fechar</button>
          </div>
        </div>
      ) : null}

      {panel?.type === "transfer" && transferMerc ? (
        <div data-ctx-menu="true" className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setPanel(null); }}>
          <form className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-4" onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); confirmTransfer(); }}>
            <p className="text-sm font-semibold">Transferir {transferMerc.nome}</p>
            <p className="text-xs text-muted-foreground">De {pavsNome(panel.origem)} para {pavsNome(transferDest)}. Disponível: {formatNumber(db.stockAt(transferMerc.id, panel.origem))} {transferMerc.unidade}.</p>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Quantidade</span>
              <input autoFocus inputMode="decimal" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} placeholder={`Quantas ${transferMerc.unidade.toLowerCase()}`} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="h-9 rounded-lg border border-border px-3 text-sm" onClick={() => setPanel(null)}>Cancelar</button>
              <button type="submit" className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">Transferir</button>
            </div>
          </form>
        </div>
      ) : null}

      {panel?.type === "quem" ? (
        <div data-ctx-menu="true" className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setPanel(null); }}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4" onMouseDown={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold">{panel.title}</p>
            <p className="text-xs text-muted-foreground">{panel.subtitle}</p>
            {panel.rows.length ? (
              <ul className="mt-3 max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {panel.rows.map((row) => (
                  <li key={row.nome} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{row.nome}</span>
                    <span className="shrink-0 tabular-nums font-medium">{row.qtd}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Ninguém retirou este produto neste mês.</p>
            )}
            <div className="mt-3 flex justify-end">
              <button type="button" className="h-9 rounded-lg border border-border px-3 text-sm" onClick={() => setPanel(null)}>Fechar</button>
            </div>
          </div>
        </div>
      ) : null}

      {panel?.type === "confirm" ? (
        <div data-ctx-menu="true" className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4" onClick={() => setPanel(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold">{panel.title}</p>
            {panel.lines.map((line) => <p key={line} className="mt-1 text-sm text-muted-foreground">{line}</p>)}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="h-9 rounded-lg border border-border px-3 text-sm" onClick={() => setPanel(null)}>Cancelar</button>
              <button type="button" className="h-9 rounded-lg bg-destructive px-3 text-sm font-medium text-destructive-foreground" onClick={() => { panel.run(); setPanel(null); }}>Confirmar</button>
            </div>
          </div>
        </div>
      ) : null}

      {rename ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4" onClick={() => setRename(null)}>
          <form className="w-full max-w-sm rounded-2xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); saveName(); }}>
            <p className="text-sm font-semibold">Mudar nome do lugar</p>
            <input autoFocus value={rename.nome} onChange={(e) => setRename({ ...rename, nome: e.target.value })} className="mt-3 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="h-9 rounded-lg border border-border px-3 text-sm" onClick={() => setRename(null)}>Cancelar</button>
              <button type="submit" className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">Salvar</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function pavsNome(id: string) {
  const p = db.listPavilhoes(true).find((x) => x.id === id);
  return p ? pavTitle(p) : id;
}

function titleFor(path: string) {
  if (path.startsWith("/estoque")) return "Estoque";
  if (path.startsWith("/entradas")) return "Entradas";
  if (path.startsWith("/historico") || path.startsWith("/nova-saida")) return "Saídas";
  if (path.startsWith("/contagem")) return "Contagem";
  if (path.startsWith("/movimentacoes")) return "Movimentações";
  if (path.startsWith("/fretes")) return "Fretes";
  if (path.startsWith("/clientes")) return "Clientes";
  if (path.startsWith("/mercadorias") || path.startsWith("/produto")) return "Produtos";
  if (path.startsWith("/pavilhoes")) return "Pavilhões";
  if (path.startsWith("/relatorios")) return "Relatórios";
  if (path === "/hoje") return "Hoje";
  if (path === "/") return "Visão geral";
  return "Ações";
}

function pageGroup(path: string, go: (to: string, search?: Record<string, string>) => void): Node[] {
  const common: Node[] = [
    { id: "p-ent", label: "Registrar entrada", run: () => go("/entradas") },
    { id: "p-sai", label: "Registrar saída", run: () => go("/nova-saida") },
    { id: "p-con", label: "Nova contagem", run: () => go("/contagem") },
  ];
  if (path.startsWith("/estoque")) return [...common, { id: "p-pdf", label: "Relatórios", run: () => go("/relatorios") }];
  if (path.startsWith("/entradas")) return common;
  if (path.startsWith("/historico")) return [{ id: "p-nova", label: "Nova saída", run: () => go("/nova-saida") }, { id: "p-est", label: "Estoque", run: () => go("/estoque") }];
  if (path.startsWith("/contagem")) return [{ id: "p-est", label: "Abrir estoque", run: () => go("/estoque") }, { id: "p-ent", label: "Registrar entrada", run: () => go("/entradas") }];
  if (path.startsWith("/fretes")) return [{ id: "p-forn", label: "Fornecedores", run: () => go("/fornecedores") }];
  if (path.startsWith("/clientes")) return [{ id: "p-sai", label: "Nova saída", run: () => go("/nova-saida") }, { id: "p-rel", label: "Relatórios", run: () => go("/relatorios") }];
  if (path.startsWith("/pavilhoes")) return common;
  if (path.startsWith("/mercadorias")) return [{ id: "p-est", label: "Estoque", run: () => go("/estoque") }, ...common];
  if (path === "/" || path.startsWith("/hoje")) return [...common, { id: "p-mov", label: "Movimentações", run: () => go("/movimentacoes") }];
  if (path.startsWith("/relatorios")) return [{ id: "p-est", label: "Estoque", run: () => go("/estoque") }, { id: "p-mov", label: "Movimentações", run: () => go("/movimentacoes") }];
  if (path.startsWith("/auditoria")) return [{ id: "p-est", label: "Estoque", run: () => go("/estoque") }];
  return common.slice(0, 3);
}

function MenuList({
  nodes,
  focus,
  onHover,
  onOpenSub,
}: {
  nodes: Node[];
  focus: number;
  onHover?: (i: number) => void;
  onOpenSub: (item: Node) => void;
}) {
  return (
    <div>
      {nodes.map((item, i) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={Boolean(item.disabled)}
          title={item.disabled || item.hint || undefined}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 px-3 text-left text-sm",
            item.danger && "text-destructive",
            item.disabled && "cursor-not-allowed opacity-45",
            !item.disabled && "hover:bg-muted",
            focus === i && "bg-muted",
          )}
          onMouseEnter={() => onHover?.(i)}
          onClick={() => {
            if (item.disabled) { notify.info(item.disabled); return; }
            if (item.children?.length) { onOpenSub(item); return; }
            void item.run?.();
          }}
        >
          <span className="min-w-0 truncate">{item.label}{item.hint ? <span className="ml-2 text-xs text-muted-foreground">{item.hint}</span> : null}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{item.children?.length ? "›" : item.shortcut || ""}</span>
        </button>
      ))}
    </div>
  );
}

function SaldoBox({ id, nome, unidade, atual }: { id: string; nome: string; unidade: string; atual: number }) {
  const movs = db.listSaidas().filter((s) => s.mercadoria_id === id);
  const contagens = db.listContagens().filter((c) => c.mercadoria_id === id && c.delta);
  const dias = new Map<string, { entrada: number; saida: number; transf: number; ajuste: number }>();
  const touch = (data: string) => {
    const row = dias.get(data) ?? { entrada: 0, saida: 0, transf: 0, ajuste: 0 };
    dias.set(data, row);
    return row;
  };
  let entradas = 0;
  let saidas = 0;
  let transf = 0;
  let ajustes = 0;
  const datas = (tipo: "entrada" | "saida" | "transf") => {
    const hits = movs.filter((s) => (tipo === "entrada" ? s.tipo === "entrada" : tipo === "transf" ? s.tipo !== "entrada" && s.destino_pavilhao_id : s.tipo !== "entrada" && !s.destino_pavilhao_id));
    const ordered = hits.map((s) => s.data).filter(Boolean).sort();
    if (!ordered.length) return "";
    return ordered[0] === ordered[ordered.length - 1] ? formatDateBR(ordered[0]) : `${formatDateBR(ordered[0])} a ${formatDateBR(ordered[ordered.length - 1])}`;
  };
  for (const s of movs) {
    const row = touch(s.data || s.created_at.slice(0, 10));
    if (s.tipo === "entrada") {
      entradas += s.quantidade;
      row.entrada += s.quantidade;
    } else if (s.destino_pavilhao_id) {
      transf += s.quantidade;
      row.transf += s.quantidade;
    } else {
      saidas += s.quantidade;
      row.saida += s.quantidade;
    }
  }
  for (const c of contagens) {
    ajustes += c.delta;
    touch(c.data).ajuste += c.delta;
  }
  const orderedDays = [...dias.keys()].sort((a, b) => b.localeCompare(a));
  const periodo = orderedDays.length ? `${formatDateBR(orderedDays[orderedDays.length - 1])} a ${formatDateBR(orderedDays[0])}` : "Sem lançamento";
  const linhas = [
    ["Entradas", entradas, datas("entrada")],
    ["Saídas", saidas, datas("saida")],
    ["Transferências", transf, datas("transf")],
  ] as const;
  return (
    <div>
      <p className="text-sm font-semibold">Explicar saldo · {nome}</p>
      <p className="mt-1 text-xs text-muted-foreground">{periodo}</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {linhas.map(([k, v, quando]) => (
          <li key={k}>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{k}</span>
              <span className="tabular-nums font-medium">{formatNumber(v)} {unidade}</span>
            </div>
            {quando ? <p className="text-xs text-muted-foreground">{quando}</p> : null}
          </li>
        ))}
        {ajustes !== 0 ? (
          <li className="flex justify-between gap-3">
            <span className="text-muted-foreground">Ajustes de contagem</span>
            <span className="tabular-nums font-medium">{ajustes > 0 ? "+" : ""}{formatNumber(ajustes)} {unidade}</span>
          </li>
        ) : null}
        <li className="flex justify-between gap-3 border-t border-border pt-1.5">
          <span className="text-muted-foreground">Estoque agora</span>
          <span className="tabular-nums font-semibold">{formatNumber(atual)} {unidade}</span>
        </li>
      </ul>
      {orderedDays.length > 0 ? (
        <ul className="mt-3 max-h-52 space-y-1.5 overflow-y-auto text-xs">
          {orderedDays.map((dia) => {
            const row = dias.get(dia)!;
            const partes = [
              row.entrada ? `Entrada ${formatNumber(row.entrada)}` : "",
              row.saida ? `Saída ${formatNumber(row.saida)}` : "",
              row.transf ? `Transf. ${formatNumber(row.transf)}` : "",
              row.ajuste ? `Ajuste ${row.ajuste > 0 ? "+" : ""}${formatNumber(row.ajuste)}` : "",
            ].filter(Boolean);
            return (
              <li key={dia} className="flex justify-between gap-3">
                <span className="shrink-0 font-medium">{formatDateBR(dia)}</span>
                <span className="text-right text-muted-foreground">{partes.join(" · ")}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">O saldo da empresa é entrada menos saída, mais ajuste. Transferência muda o pavilhão, não o total.</p>
    </div>
  );
}
