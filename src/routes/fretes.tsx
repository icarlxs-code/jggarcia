import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, FileText, Plus, Search } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { useSession } from "@/lib/session";
import { FORMAS_PAGAMENTO_FRETE, PIX_TIPOS, pixTipoLabel } from "@/lib/constants";
import { formatBRL, formatDateBR, maskCPF, maskMoney, maskPixChave, maskPlaca, parseMoney, todayISO } from "@/lib/format";
import { buildFreteHtml, exportFretePdf, missingFreteFields } from "@/lib/frete-pdf";
import { notify } from "@/lib/notify";
import { fold, cn } from "@/lib/utils";
import type { FretePagamento } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/action-menu";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { MoneyStrip } from "@/components/finance/money-strip";
import { PageStage } from "@/components/motion/page-stage";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { ActionButton } from "@/components/motion/action-button";
import { SignaturePad } from "@/components/ui/signature-pad";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { pavTitle } from "@/lib/catalog";

export const Route = createFileRoute("/fretes")({ component: Fretes });

const EMPTY: Omit<FretePagamento, "id" | "created_at" | "status" | "deleted_at" | "numero"> & { numero?: string } = {
  fornecedor: "",
  numero_bilhete: "",
  valor: 0,
  data_entrada: todayISO(),
  pavilhao: "",
  placa: "",
  motorista: "",
  cpf: "",
  assinatura_motorista: "",
  forma_pagamento: "",
  pix_tipo: "",
  pix_chave: "",
  pix_favorecido: "",
  pix_banco: "",
  rubrica: "",
  data_autorizacao: "",
  observacoes: "",
};

export function FretePage({ kind = "pagamento" }: { kind?: "pagamento" | "despesa" }) {
  const despesa = kind === "despesa";
  const titulo = despesa ? "Despesa de frete" : "Pagamento de fretes";
  const notasTitulo = despesa ? "Notas de despesa de frete" : "Notas de pagamento de frete";
  const cadastroTitulo = despesa ? "Cadastro de despesa de frete" : "Cadastro de pagamento de frete";
  const gerarLabel = despesa ? "Gerar PDF da despesa" : "Gerar PDF do pagamento";
  const arquivo = despesa ? "despesa_frete_" : "pagamento_frete_";
  const comprovante = despesa ? "Comprovante de despesa de frete" : "Comprovante de pagamento de frete";
  const live = useDb();
  const { perfil } = useSession();
  const pavilhoes = live.listPavilhoes();
  const fornecedores = live.listFornecedores();
  const list = live.listFretes(kind);
  const [form, setForm] = useState({ ...EMPTY, data_entrada: todayISO() });
  const [money, setMoney] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [motoristaF, setMotoristaF] = useState("todos");
  const [statusF, setStatusF] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [missing, setMissing] = useState<string[] | null>(null);
  const [pending, setPending] = useState<FretePagamento | null>(null);
  const [preview, setPreview] = useState<FretePagamento | null>(null);
  const [notasOpen, setNotasOpen] = useState(false);

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setPagamento(v: string) {
    setForm((f) => ({
      ...f,
      forma_pagamento: v,
      pix_tipo: v === "PIX" ? f.pix_tipo || "" : "",
      pix_chave: v === "PIX" ? f.pix_chave || "" : "",
      pix_favorecido: v === "PIX" ? f.pix_favorecido || "" : "",
      pix_banco: v === "PIX" ? f.pix_banco || "" : "",
    }));
  }

  function setPixTipo(id: string) {
    setForm((f) => ({
      ...f,
      pix_tipo: id,
      pix_chave: f.pix_tipo === id ? f.pix_chave : "",
    }));
  }

  function toDraft(): FretePagamento {
    const typed = (form.numero_bilhete || "").trim();
    const pix = form.forma_pagamento === "PIX";
    return {
      id: editingId || "draft",
      numero: editingId ? form.numero || "" : "",
      fornecedor: form.fornecedor,
      numero_bilhete: typed,
      valor: parseMoney(money) || Number(form.valor) || 0,
      data_entrada: form.data_entrada,
      pavilhao: form.pavilhao,
      motorista: form.motorista,
      placa: form.placa,
      cpf: form.cpf,
      assinatura_motorista: form.assinatura_motorista,
      forma_pagamento: form.forma_pagamento,
      pix_tipo: pix ? form.pix_tipo || "" : "",
      pix_chave: pix ? form.pix_chave || "" : "",
      pix_favorecido: pix ? (form.pix_favorecido || "").trim() : "",
      pix_banco: pix ? (form.pix_banco || "").trim() : "",
      rubrica: form.rubrica,
      data_autorizacao: form.data_autorizacao,
      observacoes: form.observacoes,
      status: "gerado",
      created_at: new Date().toISOString(),
      created_by: perfil?.id,
      created_by_nome: perfil?.nome,
      tipo: kind,
    };
  }

  function persistAndShow(draft: FretePagamento) {
    const saved = db.saveFrete({
      id: editingId || undefined,
      fornecedor: draft.fornecedor,
      numero: draft.numero,
      numero_bilhete: draft.numero_bilhete,
      valor: draft.valor,
      data_entrada: draft.data_entrada,
      pavilhao: draft.pavilhao,
      placa: draft.placa,
      motorista: draft.motorista,
      cpf: draft.cpf,
      assinatura_motorista: draft.assinatura_motorista,
      forma_pagamento: draft.forma_pagamento,
      pix_tipo: draft.pix_tipo,
      pix_chave: draft.pix_chave,
      pix_favorecido: draft.pix_favorecido,
      pix_banco: draft.pix_banco,
      rubrica: draft.rubrica,
      data_autorizacao: draft.data_autorizacao,
      observacoes: draft.observacoes,
      status: "gerado",
      created_by: perfil?.id,
      created_by_nome: perfil?.nome,
      tipo: kind,
    });
    setEditingId(saved.id);
    setForm({ ...saved });
    setMoney(saved.valor ? formatBRL(saved.valor) : "");
    setPreview(saved);
    notify.success("Comprovante gerado. Confira a nota e salve em PDF.");
    return true;
  }

  function gerar() {
    const draft = toDraft();
    const gaps = missingFreteFields(draft);
    if (gaps.length) {
      setMissing(gaps);
      return false;
    }
    return persistAndShow(draft);
  }

  function loadRow(row: FretePagamento) {
    setEditingId(row.id);
    setForm({ ...row });
    setMoney(row.valor ? formatBRL(row.valor) : "");
    setNotasOpen(true);
    document.getElementById("cadastro-frete")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    function onFrete(e: Event) {
      const detail = (e as CustomEvent<{ action?: string; id?: string }>).detail;
      if (!detail?.id) return;
      const row = live.listFretes(kind).find((f) => f.id === detail.id);
      if (!row) return;
      if (detail.action === "pdf") setPreview(row);
      else loadRow(row);
    }
    window.addEventListener("jg-frete", onFrete);
    return () => window.removeEventListener("jg-frete", onFrete);
  });

  function novo() {
    setEditingId(null);
    setForm({ ...EMPTY, data_entrada: todayISO() });
    setMoney("");
  }

  const motoristas = useMemo(() => {
    const set = new Set(list.map((f) => f.motorista.trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [list]);

  const filtered = list.filter((f) => {
    if (from && (f.data_entrada || f.created_at.slice(0, 10)) < from) return false;
    if (to && (f.data_entrada || f.created_at.slice(0, 10)) > to) return false;
    if (motoristaF !== "todos" && f.motorista !== motoristaF) return false;
    if (statusF !== "todos" && f.status !== statusF) return false;
    const term = fold(q.trim());
    if (!term) return true;
    return [f.fornecedor, f.numero, f.numero_bilhete, f.motorista, f.placa, f.pavilhao, f.forma_pagamento, f.pix_chave, f.pix_favorecido, f.pix_banco].some((x) => fold(x || "").includes(term));
  });

  const fornHits = form.fornecedor.trim()
    ? fornecedores.filter((x) => fold(x.nome).includes(fold(form.fornecedor))).slice(0, 6)
    : fornecedores.slice(0, 6);

  const draft = toDraft();
  const liveHtml = buildFreteHtml(draft, undefined, { live: true });
  const docNo = draft.numero || "rascunho";

  return (
    <PageStage className="space-y-4">
      <PageHeader
        clip={despesa ? "/lottie/moeda.json" : "/lottie/caminhao.json"}
        title={titulo}
        description="Preencha o cadastro. A nota ao lado atualiza na hora, do jeito que sai no PDF."
      >
        <Button variant="outline" onClick={novo}>
          <Plus /> Novo cadastro
        </Button>
      </PageHeader>
      <MoneyStrip fretes={list} kind={kind} />

      <section className="rounded-xl border border-border bg-card shadow-card">
        <button
          type="button"
          onClick={() => setNotasOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
          aria-expanded={notasOpen}
        >
          <span>
            <span className="block text-sm font-semibold">{notasTitulo}</span>
            <span className="text-xs text-muted-foreground">{list.length} {list.length === 1 ? "nota" : "notas"}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            {notasOpen ? "Recolher" : "Expandir"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", notasOpen && "rotate-180")} />
          </span>
        </button>
        {notasOpen ? (
          <div className="border-t border-border px-3 pb-3 pt-2">
            <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1.5fr)_9rem_9rem_12rem]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-8 pl-8 text-sm" placeholder="Buscar fornecedor, bilhete, motorista ou placa" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Input className="h-8 text-sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="De" />
              <Input className="h-8 text-sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Até" />
              <Select value={motoristaF} onValueChange={setMotoristaF}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Motorista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os motoristas</SelectItem>
                  {motoristas.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(["todos", "gerado", "rascunho"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusF(s)}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-xs font-medium",
                    statusF === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {s === "todos" ? "Todos" : s === "gerado" ? "Gerado" : "Rascunho"}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma nota neste filtro.</p>
            ) : (
              <div className="mt-2 max-h-52 overflow-auto rounded-lg border border-border">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="sticky top-0 border-b border-border bg-card text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 font-semibold">Data</th>
                      <th className="px-2 py-1.5 font-semibold">Fornecedor</th>
                      <th className="px-2 py-1.5 font-semibold">Bilhete</th>
                      <th className="px-2 py-1.5 font-semibold">Valor</th>
                      <th className="px-2 py-1.5 font-semibold">Motorista</th>
                      <th className="px-2 py-1.5 font-semibold">Status</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((f) => (
                      <tr key={f.id} data-ctx="frete" data-id={f.id} data-nome={f.fornecedor} data-extra={f.numero_bilhete || ""} className="hover:bg-muted/40">
                        <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-muted-foreground">
                          {f.data_entrada ? formatDateBR(f.data_entrada) : formatDateBR(f.created_at.slice(0, 10))}
                        </td>
                        <td className="max-w-[220px] truncate px-2 py-1.5 font-medium">{f.fornecedor || "Sem fornecedor"}</td>
                        <td className="px-2 py-1.5 font-mono text-xs">{f.numero_bilhete?.trim() || ""}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 font-semibold tabular-nums">{f.valor ? formatBRL(f.valor) : "—"}</td>
                        <td className="max-w-[160px] truncate px-2 py-1.5">{f.motorista || "—"}</td>
                        <td className="px-2 py-1.5">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", f.status === "gerado" ? "bg-primary/15 text-primary" : "bg-gold/20 text-gold-ink")}>
                            {f.status === "gerado" ? "Gerado" : "Rascunho"}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <ActionMenu label="Ações" ariaLabel={`Ações do frete ${f.numero}`}>
                            <DropdownMenuItem onSelect={() => loadRow(f)}>Abrir frete</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setPreview(f)}>Ver PDF</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onSelect={() => setPending(f)}>Excluir frete</DropdownMenuItem>
                          </ActionMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <div id="cadastro-frete" className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
      <SpotlightCard className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cadastroTitulo}</p>
            <p className="mt-1 text-sm font-medium">{editingId ? `Editando o comprovante nº ${form.numero || "—"}` : "Novo comprovante"}</p>
          </div>
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">Ao vivo</span>
        </div>

        <div className="mt-4 space-y-6">
          <fieldset className="space-y-3">
            <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">1</span>
              Dados do frete
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="fr-forn">Nome do fornecedor</Label>
                <Input id="fr-forn" value={form.fornecedor} onChange={(e) => patch("fornecedor", e.target.value)} placeholder="Transportadora XYZ Ltda." />
                {fornHits.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {fornHits.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => patch("fornecedor", x.nome)}
                        className="rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted"
                      >
                        {x.nome}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fr-bil">Número do bilhete</Label>
                <Input id="fr-bil" inputMode="numeric" value={form.numero_bilhete} onChange={(e) => patch("numero_bilhete", e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="Opcional" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fr-val">Valor do frete</Label>
                <Input id="fr-val" inputMode="numeric" value={money} onChange={(e) => setMoney(maskMoney(e.target.value))} placeholder="R$ 350,00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fr-data">Data de entrada</Label>
                <Input id="fr-data" type="date" value={form.data_entrada} onChange={(e) => patch("data_entrada", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fr-pav">Pavilhão onde descarregou</Label>
                <Input id="fr-pav" value={form.pavilhao} onChange={(e) => patch("pavilhao", e.target.value)} placeholder="Box 13/15 — Pavilhão 23" list="fr-pav-list" />
                <datalist id="fr-pav-list">
                  {pavilhoes.map((p) => (
                    <option key={p.id} value={pavTitle(p)} />
                  ))}
                </datalist>
                <div className="flex flex-wrap gap-1.5">
                  {pavilhoes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => patch("pavilhao", pavTitle(p))}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs",
                        form.pavilhao === pavTitle(p) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                      )}
                    >
                      {pavTitle(p)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">2</span>
              Dados do veículo e motorista
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="fr-placa">Placa do veículo</Label>
                <Input id="fr-placa" value={form.placa} onChange={(e) => patch("placa", maskPlaca(e.target.value))} placeholder="ABC-1234" className="uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fr-mot">Nome do motorista</Label>
                <Input id="fr-mot" value={form.motorista} onChange={(e) => patch("motorista", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fr-cpf">CPF do motorista</Label>
                <Input id="fr-cpf" inputMode="numeric" value={form.cpf} onChange={(e) => patch("cpf", maskCPF(e.target.value))} placeholder="000.000.000-00" />
              </div>
            </div>
            <SignaturePad
              label="Assinatura do motorista na tela"
              hint="Opcional. A nota impressa já sai com a linha Assinatura do motorista para caneta."
              value={form.assinatura_motorista}
              onChange={(v) => patch("assinatura_motorista", v)}
            />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">3</span>
              Pagamento
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Forma de pagamento</Label>
                <Select value={form.forma_pagamento || "__none"} onValueChange={(v) => setPagamento(v === "__none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Não informar</SelectItem>
                    {FORMAS_PAGAMENTO_FRETE.map((x) => (
                      <SelectItem key={x} value={x}>
                        {x}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.forma_pagamento === "PIX" ? (
                <div className="rounded-2xl border border-primary/30 bg-mint/40 p-3 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qual PIX?</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Escolha o tipo da chave e informe quem recebe.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PIX_TIPOS.map((t) => {
                      const on = form.pix_tipo === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setPixTipo(t.id)}
                          className={cn(
                            "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                          )}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                  {form.pix_tipo ? (
                    <div className="mt-3 space-y-1.5">
                      <Label htmlFor="fr-pix">{pixTipoLabel(form.pix_tipo)}</Label>
                      <Input
                        key={form.pix_tipo}
                        id="fr-pix"
                        autoFocus
                        value={form.pix_chave || ""}
                        onChange={(e) => patch("pix_chave", maskPixChave(form.pix_tipo || "", e.target.value))}
                        inputMode={form.pix_tipo === "email" ? "email" : form.pix_tipo === "aleatoria" ? "text" : "numeric"}
                        type={form.pix_tipo === "email" ? "email" : "text"}
                        placeholder={
                          form.pix_tipo === "cpf"
                            ? "000.000.000-00"
                            : form.pix_tipo === "cnpj"
                              ? "00.000.000/0000-00"
                              : form.pix_tipo === "celular"
                                ? "(21) 99999-9999"
                                : form.pix_tipo === "email"
                                  ? "email@exemplo.com"
                                  : "Cole a chave aleatória"
                        }
                      />
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="fr-pix-nome">Nome do favorecido</Label>
                      <Input
                        id="fr-pix-nome"
                        value={form.pix_favorecido || ""}
                        onChange={(e) => patch("pix_favorecido", e.target.value)}
                        placeholder="João da Silva"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fr-pix-banco">Banco / Instituição</Label>
                      <Input
                        id="fr-pix-banco"
                        value={form.pix_banco || ""}
                        onChange={(e) => patch("pix_banco", e.target.value)}
                        placeholder="Nubank"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <SignaturePad
              label="Autorização na tela"
              hint="Opcional. A nota impressa já sai com a linha Autorização de Pagamento para caneta."
              value={form.rubrica}
              onChange={(v) => patch("rubrica", v)}
            />
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="fr-obs">Observações</Label>
            <textarea
              id="fr-obs"
              value={form.observacoes}
              onChange={(e) => patch("observacoes", e.target.value)}
              rows={3}
              placeholder="Frete referente ao carregamento de frutas e legumes."
              className="min-h-20 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={novo}>
              Limpar formulário
            </Button>
            <Button
              type="button"
              variant="outline"
              className="ml-auto"
              onClick={() => {
                const gaps = missingFreteFields(draft);
                if (!gaps.length) {
                  notify.success("Informações completas. A nota ao lado já está pronta.");
                  return;
                }
                setMissing(gaps);
              }}
            >
              Verificar informações
            </Button>
            <ActionButton className="h-11" idleLabel={gerarLabel} pendingLabel="Montando PDF" doneLabel="PDF pronto" onAction={gerar}>
              <FileText /> Gerar PDF
            </ActionButton>
          </div>
        </div>
      </SpotlightCard>

      <aside className="xl:sticky xl:top-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-forest px-3 py-2 text-primary-foreground">
            <p className="truncate font-mono text-xs font-medium">{arquivo}{docNo}.pdf</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 border-white/25 bg-white text-forest hover:bg-white/90"
              onClick={() => exportFretePdf(draft)}
            >
              <FileText /> Imprimir
            </Button>
          </div>
          <iframe
            title="Nota do comprovante em tempo real"
            srcDoc={liveHtml}
            className="h-[min(78vh,920px)] w-full bg-white"
          />
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">A nota sai com linha de caneta para Assinatura do motorista e Autorização de Pagamento.</p>
      </aside>
      </div>

      <Dialog open={!!missing} onOpenChange={(o) => !o && setMissing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atenção</DialogTitle>
            <DialogDescription>Existem campos que não foram preenchidos. Deseja gerar o PDF mesmo assim?</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {(missing || []).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMissing(null)}>
              Preencher
            </Button>
            <Button
              onClick={() => {
                const draft = toDraft();
                persistAndShow(draft);
                setMissing(null);
              }}
            >
              Prosseguir mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-[min(52rem,96vw)] max-h-[min(94dvh,56rem)] p-3 sm:p-4">
          <DialogHeader>
            <DialogTitle>{comprovante}</DialogTitle>
            <DialogDescription>Campos em branco não entram na nota. Imprima ou salve como PDF.</DialogDescription>
          </DialogHeader>
          {preview ? (
            <iframe
              title="Prévia do comprovante"
              srcDoc={buildFreteHtml(preview)}
              className="h-[min(68dvh,900px)] w-full rounded-lg border border-border bg-white"
            />
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                if (preview) exportFretePdf(preview);
              }}
            >
              <FileText /> Imprimir / Salvar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={pending ? `Excluir frete nº ${pending.numero}?` : "Excluir"}
        description="Sai do histórico. O comprovante já impresso não some do papel."
        mark="truck"
        onConfirm={() => {
          if (!pending) return;
          db.deleteFrete(pending.id);
          if (editingId === pending.id) novo();
          notify.success("Frete excluído.");
        }}
      />
    </PageStage>
  );
}

function Fretes() {
  return <FretePage kind="pagamento" />;
}

