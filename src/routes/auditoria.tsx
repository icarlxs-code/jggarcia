import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ScrollText, Search, Undo2 } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { formatDateBR, formatDateTimeBR } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { AuditAcao, AuditEntidade, AuditLog } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { fold } from "@/lib/utils";

export const Route = createFileRoute("/auditoria")({ component: Auditoria });

const ACOES: { value: AuditAcao | "todas"; label: string }[] = [
  { value: "todas", label: "Todas as ações" },
  { value: "cadastrou", label: "Lançou / cadastrou" },
  { value: "editou", label: "Alterou" },
  { value: "excluiu", label: "Removeu" },
  { value: "ativou", label: "Ativou" },
  { value: "desativou", label: "Desativou" },
  { value: "login", label: "Login" },
  { value: "reconheceu", label: "Dispositivo" },
];

const ENTIDADES: { value: AuditEntidade | "todas"; label: string }[] = [
  { value: "todas", label: "Tudo" },
  { value: "entrada", label: "Entradas" },
  { value: "saida", label: "Saídas" },
  { value: "produto", label: "Produtos" },
  { value: "contagem", label: "Contagens" },
  { value: "destino", label: "Destinos" },
  { value: "usuario", label: "Usuários" },
  { value: "seguranca", label: "Segurança" },
];

function acaoBadge(acao: AuditAcao) {
  if (acao === "excluiu" || acao === "desativou") return "destructive" as const;
  if (acao === "editou") return "gold" as const;
  if (acao === "cadastrou") return "success" as const;
  if (acao === "login" || acao === "reconheceu") return "muted" as const;
  return "muted" as const;
}

function acaoLabel(acao: AuditAcao) {
  if (acao === "cadastrou") return "Lançou";
  if (acao === "editou") return "Alterou";
  if (acao === "excluiu") return "Removeu";
  if (acao === "ativou") return "Ativou";
  if (acao === "desativou") return "Desativou";
  if (acao === "login") return "Entrou";
  if (acao === "reconheceu") return "Reconheceu";
  return acao;
}

function entidadeLabel(entidade: AuditEntidade) {
  if (entidade === "entrada") return "entrada";
  if (entidade === "saida") return "saída";
  if (entidade === "produto") return "produto";
  if (entidade === "destino") return "destino";
  if (entidade === "usuario") return "usuário";
  if (entidade === "lote") return "lote";
  if (entidade === "pavilhao") return "pavilhão";
  if (entidade === "contagem") return "contagem";
  if (entidade === "seguranca") return "segurança";
  if (entidade === "fornecedor") return "fornecedor";
  if (entidade === "empilhador") return "empilhador";
  if (entidade === "frete") return "frete";
  return entidade;
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function canUndo(l: AuditLog) {
  if (l.entidade !== "entrada" && l.entidade !== "saida") return false;
  if (l.acao !== "cadastrou" && l.acao !== "editou") return false;
  return true;
}

function Auditoria() {
  const live = useDb();
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState("");
  const [acao, setAcao] = useState<AuditAcao | "todas">("todas");
  const [entidade, setEntidade] = useState<AuditEntidade | "todas">("todas");
  const [pending, setPending] = useState<AuditLog | null>(null);
  const logs = useMemo(() => live.listLogs(), [live, tick]);
  const saidas = useMemo(() => live.listSaidas(), [live, tick]);
  const mercadorias = useMemo(() => live.listMercadorias(true), [live, tick]);
  const destinos = useMemo(() => live.listDestinos(true), [live, tick]);

  const filtered = logs.filter((l) => {
    if (acao !== "todas" && l.acao !== acao) return false;
    if (entidade !== "todas" && l.entidade !== entidade) return false;
    const term = fold(q);
    if (!term) return true;
    const saida = saidas.find((s) => s.id === l.entidade_id);
    const merc = saida ? mercadorias.find((m) => m.id === saida.mercadoria_id) : mercadorias.find((m) => m.id === l.entidade_id);
    const dest = saida ? destinos.find((d) => d.id === saida.destino_id) : destinos.find((d) => d.id === l.entidade_id);
    const blob = [
      l.usuario_nome,
      l.resumo,
      l.detalhe,
      acaoLabel(l.acao),
      entidadeLabel(l.entidade),
      merc?.nome,
      merc?.codigo,
      dest?.nome,
      saida?.operador_nome,
      saida?.empilhadeira,
      saida?.origem,
    ]
      .filter(Boolean)
      .join(" ");
    return fold(blob).includes(term);
  });

  const groups = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    for (const l of filtered) {
      const key = dayKey(l.created_at);
      const list = map.get(key) ?? [];
      list.push(l);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  function aplicarDesfazer(l: AuditLog) {
    if (l.acao === "cadastrou") {
      const snap = db.deleteSaida(l.entidade_id);
      setTick((n) => n + 1);
      notify.success("Lançamento desfeito. O estoque voltou ao que era.");
      if (snap) {
        notify.success("Pode recolocar se foi engano.", {
          action: {
            label: "Recolocar",
            onClick: () => {
              db.restoreSaida(snap);
              setTick((n) => n + 1);
            },
          },
        });
      }
      return;
    }
    if (l.acao === "editou" && l.detalhe) {
      const m = l.detalhe.match(/Quantidade\s+([0-9.,]+)\s*→/i);
      if (m) {
        const before = Number(String(m[1]).replace(",", "."));
        if (before > 0) {
          db.updateSaida(l.entidade_id, { quantidade: before });
          setTick((n) => n + 1);
          notify.success("Quantidade voltou ao valor anterior.");
          return;
        }
      }
    }
    notify.error("Não foi possível desfazer este registro.");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        clip="/lottie/prancheta.json"
        title="Log de alterações"
        description="Tudo que a equipe lançou, alterou ou removeu — com nome, horário e opção de desfazer."
      />
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Buscar pessoa, produto, cliente ou detalhe"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            type="search"
          />
        </div>
        <Select value={acao} onValueChange={(v) => setAcao(v as AuditAcao | "todas")}>
          <SelectTrigger className="lg:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACOES.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entidade} onValueChange={(v) => setEntidade(v as AuditEntidade | "todas")}>
          <SelectTrigger className="lg:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTIDADES.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={ScrollText}
              clip={q.trim() ? undefined : "/lottie/prancheta.json"}
              title={q.trim() ? "Nada neste filtro" : "Nenhum registro"}
              description={q.trim() ? "A busca já filtra enquanto você escreve. Tente outro termo." : "Quando alguém lançar entrada, saída ou alterar um cadastro, aparece aqui."}
            />
          </CardContent>
        </Card>
      ) : (
        groups.map(([day, items]) => (
          <section key={day} className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {day === new Date().toISOString().slice(0, 10) ? "Hoje" : formatDateBR(day)}
            </h2>
            <Card>
              <ul className="divide-y divide-border">
                {items.map((l) => (
                  <li key={l.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={acaoBadge(l.acao)}>
                          {acaoLabel(l.acao)} {entidadeLabel(l.entidade)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTimeBR(l.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium leading-snug">{l.resumo}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.usuario_nome}
                        {l.detalhe ? ` · ${l.detalhe}` : ""}
                      </p>
                    </div>
                    {canUndo(l) ? (
                      <Button variant="outline" size="sm" className="shrink-0" onClick={() => setPending(l)}>
                        <Undo2 className="h-3.5 w-3.5" />
                        Desfazer
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title="Desfazer este lançamento?"
        description="O estoque volta ao valor de antes. Se foi engano, dá para recolocar em seguida."
        confirmLabel="Desfazer"
        onConfirm={() => {
          if (pending) aplicarDesfazer(pending);
          setPending(null);
        }}
      />
    </div>
  );
}
