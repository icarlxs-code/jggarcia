import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { useSession } from "@/lib/session";
import { formatBRL, formatDateBR, formatNumber, maskMoney, nowHHMM, parseMoney, todayISO } from "@/lib/format";
import { exportRequisicaoPdf } from "@/lib/requisicao-pdf";
import { enterNext } from "@/lib/field-flow";
import { notify } from "@/lib/notify";
import { fold, cn } from "@/lib/utils";
import type { RequisicaoFornecedor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { OpNote } from "@/components/motion/lottie-clip";
import { PageStage } from "@/components/motion/page-stage";
import { SignaturePad } from "@/components/ui/signature-pad";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ProductPicker } from "@/components/inventory/product-picker";

export const Route = createFileRoute("/requisicoes")({ component: Requisicoes });

type FormState = {
  fornecedor: string;
  mercadoriaId: string;
  quantidade: string;
  valor: string;
  carregador: string;
  vendedor: string;
  assinatura_responsavel: string;
  assinatura_fornecedor: string;
};

const EMPTY: FormState = {
  fornecedor: "",
  mercadoriaId: "",
  quantidade: "",
  valor: "",
  carregador: "",
  vendedor: "",
  assinatura_responsavel: "",
  assinatura_fornecedor: "",
};

function Requisicoes() {
  const live = useDb();
  const { perfil } = useSession();
  const rows = live.listRequisicoes();
  const fornecedores = live.listFornecedores();
  const mercadorias = live.listMercadorias();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fornF, setFornF] = useState("todos");
  const [mercF, setMercF] = useState("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RequisicaoFornecedor | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [view, setView] = useState<RequisicaoFornecedor | null>(null);
  const [pending, setPending] = useState<RequisicaoFornecedor | null>(null);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function abrirNova() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function abrirEdicao(row: RequisicaoFornecedor) {
    const porId = row.mercadoria_id ? mercadorias.find((m) => m.id === row.mercadoria_id) : undefined;
    const porCodigo = !porId && row.mercadoria_codigo ? mercadorias.find((m) => m.codigo === row.mercadoria_codigo) : undefined;
    const porNome = !porId && !porCodigo ? mercadorias.find((m) => fold(m.nome) === fold(row.mercadoria)) : undefined;
    setEditing(row);
    setForm({
      fornecedor: row.fornecedor,
      mercadoriaId: (porId || porCodigo || porNome)?.id || "",
      quantidade: String(row.quantidade ?? ""),
      valor: row.valor ? formatBRL(row.valor) : "",
      carregador: row.carregador || "",
      vendedor: row.vendedor || "",
      assinatura_responsavel: row.assinatura_responsavel || "",
      assinatura_fornecedor: row.assinatura_fornecedor || "",
    });
    setView(null);
    setOpen(true);
  }

  function salvar(andPdf: boolean) {
    const fornecedor = form.fornecedor.trim();
    const produto = mercadorias.find((m) => m.id === form.mercadoriaId);
    const quantidade = Number(String(form.quantidade).replace(",", "."));
    if (!fornecedor) {
      notify.error("Informe o fornecedor.");
      return;
    }
    if (!produto) {
      notify.error("Selecione uma mercadoria já cadastrada.");
      return;
    }
    if (!quantidade || quantidade <= 0) {
      notify.error("Informe a quantidade.");
      return;
    }
    const saved = db.saveRequisicao({
      id: editing?.id,
      fornecedor,
      mercadoria: produto.nome,
      mercadoria_id: produto.id,
      mercadoria_codigo: produto.codigo,
      quantidade,
      valor: parseMoney(form.valor) || 0,
      carregador: form.carregador.trim(),
      vendedor: form.vendedor.trim(),
      assinatura_responsavel: form.assinatura_responsavel,
      assinatura_fornecedor: form.assinatura_fornecedor,
      data: editing?.data || todayISO(),
      horario: editing?.horario || nowHHMM(),
      usuario_id: editing?.usuario_id || perfil?.id || "",
      usuario_nome: editing?.usuario_nome || perfil?.nome || "",
    });
    setOpen(false);
    setEditing(null);
    notify.success(editing ? `Requisição nº ${saved.numero} atualizada.` : `Requisição nº ${saved.numero} salva.`);
    if (andPdf) exportRequisicaoPdf(saved);
  }

  const fornOpts = useMemo(() => {
    const set = new Set<string>();
    for (const f of fornecedores) if (f.nome.trim()) set.add(f.nome.trim());
    for (const r of rows) if (r.fornecedor.trim()) set.add(r.fornecedor.trim());
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [fornecedores, rows]);

  const mercOpts = useMemo(() => {
    const set = new Set<string>();
    for (const m of mercadorias) if (m.nome.trim()) set.add(m.nome.trim());
    for (const r of rows) if (r.mercadoria.trim()) set.add(r.mercadoria.trim());
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [mercadorias, rows]);

  const carregadores = useMemo(() => unique(rows.map((r) => r.carregador)), [rows]);
  const vendedores = useMemo(() => unique(rows.map((r) => r.vendedor)), [rows]);

  const filtered = rows.filter((r) => {
    if (from && r.data < from) return false;
    if (to && r.data > to) return false;
    if (fornF !== "todos" && r.fornecedor !== fornF) return false;
    if (mercF !== "todos" && r.mercadoria !== mercF) return false;
    const term = fold(q.trim());
    if (!term) return true;
    return [r.numero, r.fornecedor, r.mercadoria, r.mercadoria_codigo, r.carregador, r.vendedor].some((x) => fold(x || "").includes(term));
  });

  return (
    <PageStage className="space-y-4">
      <PageHeader clip="/lottie/prancheta.json" title="Requisição de Fornecedor" description="Cada pedido recebe um número de série único. O número não muda e não volta a ser usado.">
        <Button onClick={abrirNova}>
          <Plus /> Nova Requisição
        </Button>
      </PageHeader>

      <section className="rounded-xl border border-border bg-card p-3 shadow-card">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_9rem_9rem_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 pl-8" placeholder="Número, fornecedor, mercadoria, carregador ou vendedor" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Input className="h-9" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Data inicial" />
          <Input className="h-9" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Data final" />
          <Select value={fornF} onValueChange={setFornF}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os fornecedores</SelectItem>
              {fornOpts.map((nome) => (
                <SelectItem key={nome} value={nome}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mercF} onValueChange={setMercF}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Mercadoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as mercadorias</SelectItem>
              {mercOpts.map((nome) => (
                <SelectItem key={nome} value={nome}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {filtered.length === 0 ? (
          <OpNote
            className="border-0 bg-transparent shadow-none"
            src="/lottie/prancheta.json"
            title="Nenhuma requisição neste filtro"
            detail="Ajuste a busca ou lance um pedido novo. O número de série não se repete."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Nº Requisição", "Data", "Fornecedor", "Mercadoria", "Quantidade", "Valor", "Carregador", "Vendedor", "Responsável", "Ações"].map((h) => (
                    <th key={h} className={cn("px-3 py-2 font-semibold", h === "Ações" && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-2"><span className="serial-stamp">nº {r.numero}</span></td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                      {formatDateBR(r.data)}
                      <span className="block text-xs">{r.horario}</span>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 font-medium">{r.fornecedor}</td>
                    <td className="max-w-[180px] truncate px-3 py-2">{r.mercadoria_codigo ? `${r.mercadoria_codigo} — ${r.mercadoria}` : r.mercadoria}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(r.quantidade)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums">{r.valor ? formatBRL(r.valor) : "—"}</td>
                    <td className="max-w-[140px] truncate px-3 py-2">{r.carregador || "—"}</td>
                    <td className="max-w-[140px] truncate px-3 py-2">{r.vendedor || "—"}</td>
                    <td className="max-w-[140px] truncate px-3 py-2">{r.usuario_nome || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => setView(r)}>
                          Visualizar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => abrirEdicao(r)}>
                          <Pencil /> Editar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportRequisicaoPdf(r)}>
                          <FileText /> Gerar PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportRequisicaoPdf(r)}>
                          <Printer /> Imprimir
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setPending(r)}>
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(92dvh,52rem)] max-w-[min(44rem,96vw)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Requisição nº ${editing.numero}` : "Nova requisição"}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Criada em ${formatDateBR(editing.data)} às ${editing.horario} por ${editing.usuario_nome || "—"}. O número não muda.`
                : "O número de série é gerado ao salvar, em sequência, e não se repete."}
            </DialogDescription>
          </DialogHeader>
          <div data-flow className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fornecedor" id="rq-forn" step={1} value={form.fornecedor} onChange={(v) => patch("fornecedor", v)} list="rq-forn-list" placeholder="Nome do fornecedor" />
              <datalist id="rq-forn-list">
                {fornOpts.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
              <div className="space-y-1.5">
                <Label htmlFor="rq-merc">Mercadoria</Label>
                <ProductPicker
                  key={editing?.id || "nova"}
                  items={mercadorias}
                  value={form.mercadoriaId}
                  onChange={(id) => patch("mercadoriaId", id)}
                  inputId="rq-merc"
                  listId="rq-merc-lista"
                  placeholder="Nome ou código"
                  inline
                  flowStep={2}
                />
              </div>
              <Field label="Quantidade" id="rq-qtd" step={3} value={form.quantidade} onChange={(v) => patch("quantidade", v.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder="0" />
              <Field label="Valor da mercadoria" id="rq-val" step={4} value={form.valor} onChange={(v) => patch("valor", maskMoney(v))} inputMode="numeric" placeholder="R$ 0,00" />
              <Field label="Carregador" id="rq-car" step={5} value={form.carregador} onChange={(v) => patch("carregador", v)} list="rq-car-list" placeholder="Nome do carregador" />
              <datalist id="rq-car-list">
                {carregadores.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
              <Field label="Vendedor" id="rq-ven" step={6} value={form.vendedor} onChange={(v) => patch("vendedor", v)} list="rq-ven-list" placeholder="Nome do vendedor" />
              <datalist id="rq-ven-list">
                {vendedores.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SignaturePad
                label="Assinatura do responsável pela requisição"
                value={form.assinatura_responsavel}
                onChange={(v) => patch("assinatura_responsavel", v)}
                flowStep={7}
                onFlowEnter={(e) => enterNext(e)}
              />
              <SignaturePad
                label="Assinatura do fornecedor"
                value={form.assinatura_fornecedor}
                onChange={(v) => patch("assinatura_fornecedor", v)}
                flowStep={8}
                onFlowEnter={(e) => enterNext(e)}
              />
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" data-step={9} onClick={() => salvar(false)}>
                  Salvar requisição
                </Button>
                <Button type="button" onClick={() => salvar(true)}>
                  <FileText /> Salvar e gerar PDF
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="max-h-[min(92dvh,48rem)] max-w-[min(40rem,96vw)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Requisição nº {view?.numero}</DialogTitle>
            <DialogDescription>
              {view ? `${formatDateBR(view.data)} às ${view.horario} · ${view.usuario_nome || "—"}` : ""}
            </DialogDescription>
          </DialogHeader>
          {view ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Info k="Fornecedor" v={view.fornecedor} />
              <Info k="Mercadoria" v={view.mercadoria_codigo ? `${view.mercadoria_codigo} — ${view.mercadoria}` : view.mercadoria} />
              <Info k="Quantidade" v={formatNumber(view.quantidade)} />
              <Info k="Valor" v={view.valor ? formatBRL(view.valor) : "—"} />
              <Info k="Carregador" v={view.carregador || "—"} />
              <Info k="Vendedor" v={view.vendedor || "—"} />
              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                <SignView label="Assinatura do responsável" src={view.assinatura_responsavel} />
                <SignView label="Assinatura do fornecedor" src={view.assinatura_fornecedor} />
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => view && abrirEdicao(view)}>
              Editar
            </Button>
            <Button variant="outline" onClick={() => view && exportRequisicaoPdf(view)}>
              <Printer /> Imprimir
            </Button>
            <Button onClick={() => view && exportRequisicaoPdf(view)}>
              <FileText /> Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={pending ? `Excluir a requisição nº ${pending.numero}?` : "Excluir requisição"}
        description="O número desta requisição não será usado de novo."
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!pending) return;
          db.deleteRequisicao(pending.id);
          notify.success(`Requisição nº ${pending.numero} excluída. O número não volta.`);
        }}
      />
    </PageStage>
  );
}

function unique(values: string[]) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  list,
  inputMode,
  step,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  list?: string;
  inputMode?: "decimal" | "numeric" | "text";
  step: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        list={list}
        inputMode={inputMode}
        placeholder={placeholder}
        data-step={step}
        onKeyDown={(e) => enterNext(e)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 font-medium">{v}</dd>
    </div>
  );
}

function SignView({ label, src }: { label: string; src?: string }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border bg-white">
        {src ? <img src={src} alt="" className="max-h-20 max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">Sem assinatura</span>}
      </div>
    </div>
  );
}

