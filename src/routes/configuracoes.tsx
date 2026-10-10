import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { useDb } from "@/lib/use-db";
import { getDbGen } from "@/lib/store";
import { pavTitle } from "@/lib/catalog";
import { notify } from "@/lib/notify";
import { databaseUsage } from "@/lib/cloud";
import { formatNumber } from "@/lib/format";
import { formatBytes, readDeviceDbSpace, type LocalDbSpace } from "@/lib/db-space";
import { inkFor, THEME_PRESETS, type ThemeId } from "@/lib/theme";
import {
  CHART_WIDGETS,
  readUiPrefs,
  resetUiPrefs,
  setUserPalette,
  subscribePrefs,
  writeUiPrefs,
  type ChartWidgetId,
  type PeriodoPadrao,
  type UserUiPrefs,
} from "@/lib/ui-prefs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/configuracoes")({ component: Configuracoes });

function useAccountPrefs(userId?: string) {
  const [prefs, setPrefs] = useState<UserUiPrefs>(() => readUiPrefs(userId));
  useEffect(() => {
    setPrefs(readUiPrefs(userId));
    return subscribePrefs(() => setPrefs(readUiPrefs(userId)));
  }, [userId]);
  return prefs;
}

function Configuracoes() {
  const { perfil, isAdmin } = useSession();
  const live = useDb();
  const prefs = useAccountPrefs(perfil?.id);
  const pavilhoes = live.listPavilhoes().filter((p) => p.ativo);
  const papel = isAdmin ? "Administrador" : "Operador";
  const customInk = inkFor(prefs.temaCor);

  function save(patch: Partial<UserUiPrefs>, msg = "Salvo nesta conta.") {
    if (!perfil) return;
    writeUiPrefs(perfil.id, patch);
    notify.success(msg);
  }

  function pickTheme(id: ThemeId) {
    if (!perfil) return;
    setUserPalette(perfil.id, id);
    notify.success(`${THEME_PRESETS.find((t) => t.id === id)?.label ?? "Tema"} só nesta conta.`);
  }

  function pickColor(cor: string) {
    if (!perfil) return;
    setUserPalette(perfil.id, "cor", cor);
  }

  return (
    <PageStage className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        icon="gear"
        title="Configurações"
        description={`${perfil?.nome ?? "Conta"} · ${papel}. Vale só para este usuário.`}
      >
        <Button
          variant="outline"
          onClick={() => {
            if (!perfil) return;
            resetUiPrefs(perfil.id);
            notify.success("Padrão restaurado só nesta conta.");
          }}
        >
          Restaurar padrão
        </Button>
      </PageHeader>

      <SettingsGroup title="Desempenho">
        <SettingRow
          label="Sistema lite"
          hint={prefs.sistemaLite ? "Ligado. Sem animação, sem transição e sem foto de produto." : "Desligado. Para computador mais antigo, a tela fica imediata."}
          onClick={() => save({ sistemaLite: !prefs.sistemaLite }, prefs.sistemaLite ? "Sistema lite desligado nesta conta." : "Sistema lite ligado nesta conta.")}
        >
          <StatusPill on={prefs.sistemaLite} />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Aparência">
        <div className="px-4 py-3">
          <p className="text-sm font-medium">Tema</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Fundo claro usa letra escura. Fundo escuro usa letra clara.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {THEME_PRESETS.map((t) => {
              const on = prefs.temaId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  title={t.hint}
                  onClick={() => pickTheme(t.id)}
                  className={cn("theme-swatch overflow-hidden rounded-lg border text-left", on ? "is-on ring-2 ring-primary" : "border-border")}
                  style={{ background: t.tokens.background, color: t.tokens.foreground, borderColor: on ? t.tokens.primary : t.tokens.border }}
                >
                  <span className="block h-1.5" style={{ background: t.tokens.primary }} />
                  <span className="block truncate px-2 py-2 text-xs font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border">
            <span className="sr-only">Cor personalizada</span>
            <input
              type="color"
              value={prefs.temaCor}
              aria-label="Cor personalizada"
              className="absolute -left-2 -top-2 h-12 w-12 cursor-pointer border-0 bg-transparent p-0"
              onChange={(e) => pickColor(e.target.value)}
            />
          </label>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Cor personalizada</p>
            <p className="text-xs text-muted-foreground">A letra acompanha o fundo para continuar legível.</p>
          </div>
          <span className="rounded-md px-2 py-1 text-xs font-semibold" style={{ background: prefs.temaCor, color: customInk }}>
            Aa
          </span>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Operação">
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Pavilhão padrão</Label>
            <Select value={prefs.pavilhaoPadraoId || "nenhum"} onValueChange={(id) => save({ pavilhaoPadraoId: id === "nenhum" ? "" : id }, "Lugar padrão salvo nesta conta.")}>
              <SelectTrigger>
                <SelectValue placeholder="Sem padrão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem padrão</SelectItem>
                {pavilhoes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {pavTitle(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NumField label="Validade (dias)" value={prefs.validadeDias} onCommit={(n) => save({ validadeDias: n })} />
          <NumField label="Crítico (%)" value={prefs.criticoPct} onCommit={(n) => save({ criticoPct: n })} />
          <NumField label="Baixo (%)" value={prefs.baixoPct} onCommit={(n) => save({ baixoPct: n })} />
          <div className="space-y-1.5">
            <Label>Período padrão</Label>
            <div className="flex h-9 overflow-hidden rounded-md border border-border">
              {(
                [
                  ["hoje", "Hoje"],
                  ["7", "7 dias"],
                  ["30", "30 dias"],
                ] as [PeriodoPadrao, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => save({ periodoPadrao: id }, "Período salvo nesta conta.")}
                  className={cn(
                    "flex-1 px-2 text-xs font-medium",
                    prefs.periodoPadrao === id ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <SettingRow
          label="Descontar estoque na saída"
          hint="A nova saída já abre marcada para baixar o estoque."
          onClick={() => save({ descontaPadrao: !prefs.descontaPadrao })}
        >
          <StatusPill on={prefs.descontaPadrao} />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Avisos">
        <SettingRow
          label="Animação ao salvar"
          hint="Aviso visual quando um cadastro ou uma saída é confirmada."
          onClick={() => save({ som: !prefs.som }, prefs.som ? "Animação desligada nesta conta." : "Animação ligada nesta conta.")}
        >
          <StatusPill on={prefs.som} />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Painel do dia">
        {CHART_WIDGETS.map((w) => (
          <SettingRow
            key={w.id}
            label={w.label}
            hint={w.hint}
            onClick={() => {
              const id = w.id as ChartWidgetId;
              save({ charts: { ...prefs.charts, [id]: !prefs.charts[id] } }, "Painel salvo nesta conta.");
            }}
          >
            <StatusPill on={prefs.charts[w.id] !== false} />
          </SettingRow>
        ))}
      </SettingsGroup>

      <EspacoBanco />
    </PageStage>
  );
}

function EspacoBanco() {
  const gen = getDbGen();
  const live = useDb();
  const [local, setLocal] = useState<LocalDbSpace | null>(null);
  const [server, setServer] = useState<{ ok: boolean; dbBytes: number; payloadBytes: number; revisions: number; revisionsBytes: number } | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let cancel = false;
    const timer = window.setTimeout(() => {
      void readDeviceDbSpace().then((next) => {
        if (cancel) return;
        setLocal((prev) => (prev && mesmaMedida(prev, next) ? prev : next));
      });
      void databaseUsage({ data: {} })
        .then((next) => {
          if (cancel) return;
          setServer((prev) => (prev && prev.payloadBytes === next.payloadBytes && prev.revisionsBytes === next.revisionsBytes && prev.revisions === next.revisions ? prev : next));
        })
        .catch(() => undefined);
    }, 350);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [gen]);

  const mercs = live.listMercadorias();
  const fotos = mercs.reduce((n, m) => n + (m.foto ? 1 : 0) + (m.foto_original && m.foto_original !== m.foto ? 1 : 0), 0);
  const entradas = live.listSaidas({ tipo: "entrada" });
  const saidas = live.listSaidas({ tipo: "saida" });
  const fretes = live.listFretes();
  const mediaProduto = mediaDe(mercs.map((m) => semFoto(m)), 420);
  const mediaFoto = mediaDe(
    mercs.flatMap((m) => [m.foto, m.foto_original].filter((f): f is string => Boolean(f && f.length > 30))),
    50 * 1024,
  );
  const mediaEntrada = mediaDe(entradas, 700);
  const mediaSaida = mediaDe(saidas, 750);
  const mediaFrete = mediaDe(fretes, 1600);

  const livreAlvo = local?.quotaNavegador ? local.livre : 0;
  const usadoAlvo = local?.usado ?? 0;
  const pctAlvo = local && local.limite > 0 ? Math.min(100, ((local.usoNavegador ?? local.usado) / local.limite) * 100) : 0;
  const livre = useTween(livreAlvo);
  const usado = useTween(usadoAlvo);
  const pct = useTween(pctAlvo);
  const cabe = (media: number) => (local?.quotaNavegador ? Math.max(0, Math.floor(livre / media)) : null);

  const linhas = [
    { nome: "Produtos", tem: mercs.length, cabe: cabe(mediaProduto) },
    { nome: "Fotos", tem: fotos, cabe: cabe(mediaFoto) },
    { nome: "Entradas", tem: entradas.length, cabe: cabe(mediaEntrada) },
    { nome: "Saídas", tem: saidas.length, cabe: cabe(mediaSaida) },
    { nome: "Montagens de frete", tem: fretes.length, cabe: cabe(mediaFrete) },
  ];

  return (
    <SettingsGroup title="Dados">
      <div className="px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Uso deste aparelho</span>
          <span className="tabular-nums">{local ? `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%` : "—"}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Arquivo {formatBytes(usado)}</span>
          <span className="font-medium tabular-nums">Livre {local ? formatBytes(livre) : "—"}</span>
        </div>
      </div>
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-muted/40">
        <span>
          <span className="block font-medium">Capacidade</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">Produtos, fotos, entradas, saídas e montagens. Não fica aberto.</span>
        </span>
        <span className="text-xs font-medium text-muted-foreground">{aberto ? "Ocultar" : "Ver"}</span>
      </button>
      {aberto ? (
        <div className="px-4 py-3">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 text-sm">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Item</span>
            <span className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">No sistema</span>
            <span className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">Ainda cabe</span>
            {linhas.map((linha) => (
              <span key={linha.nome} className="contents">
                <span>{linha.nome}</span>
                <span className="text-right font-medium tabular-nums">{formatNumber(linha.tem)}</span>
                <span className="text-right font-medium tabular-nums">{linha.cabe == null ? "—" : formatNumber(linha.cabe)}</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            A conta usa o espaço livre deste aparelho e o tamanho médio do que já está gravado.
            {server?.ok ? ` No servidor o arquivo está em ${formatBytes(server.payloadBytes)} e há ${formatNumber(server.revisions)} cópias (${formatBytes(server.revisionsBytes)}).` : ""}
          </p>
        </div>
      ) : null}
    </SettingsGroup>
  );
}

function mesmaMedida(a: LocalDbSpace, b: LocalDbSpace) {
  return a.usado === b.usado && a.livre === b.livre && a.limite === b.limite && a.quotaNavegador === b.quotaNavegador && a.usoNavegador === b.usoNavegador;
}

function semFoto(m: { foto?: string; foto_original?: string }) {
  const { foto: _f, foto_original: _o, ...resto } = m;
  return resto;
}

function mediaDe(itens: unknown[], fallback: number) {
  const amostra = itens.slice(0, 40);
  if (!amostra.length) return fallback;
  const total = amostra.reduce<number>((n, item) => n + (typeof item === "string" ? item.length : jsonBytes(item)), 0);
  const media = total / amostra.length;
  return media > 32 ? media : fallback;
}

function jsonBytes(value: unknown) {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

function useTween(alvo: number) {
  const [valor, setValor] = useState(alvo);
  const atual = useRef(alvo);
  useEffect(() => {
    const inicio = atual.current;
    const delta = alvo - inicio;
    if (Math.abs(delta) < 0.5) {
      atual.current = alvo;
      setValor(alvo);
      return;
    }
    const t0 = performance.now();
    const duracao = 420;
    let quadro = 0;
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - t0) / duracao);
      const eased = 1 - (1 - p) * (1 - p);
      const proximo = inicio + delta * eased;
      atual.current = proximo;
      setValor(proximo);
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo]);
  return valor;
}

function NumField({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        key={`${label}-${value}`}
        type="number"
        defaultValue={value}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n !== value) onCommit(n);
        }}
      />
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{children}</div>
    </section>
  );
}

function SettingRow({ label, hint, onClick, children }: { label: string; hint: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/40">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      </span>
      {children}
    </button>
  );
}

function StatusPill({ on }: { on: boolean }) {
  return (
    <span className={cn("shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
      {on ? "Ligado" : "Desligado"}
    </span>
  );
}
