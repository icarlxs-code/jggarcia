import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MapPin, Plus, RotateCcw, BookmarkPlus } from "lucide-react";
import { db, hydrateFromCloud, loteStatus, resolvePavilhaoId } from "@/lib/store";
import type { Mercadoria } from "@/lib/types";
import { useSession } from "@/lib/session";
import { logoOfPavilhao, pavTitle } from "@/lib/catalog";
import { calcTransportTime, completeTime, formatMinutes, formatNumber, isValidTime, todayISO } from "@/lib/format";
import { arrivalStamp } from "@/lib/movement";
import { useDb } from "@/lib/use-db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeField } from "@/components/ui/time-field";
import { ActionButton } from "@/components/motion/action-button";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { StockSplit } from "@/components/inventory/stock-split";
import { ProductPicker } from "@/components/inventory/product-picker";
import { PavPicker } from "@/components/inventory/pav-mark";
import { RoutePreview } from "@/components/inventory/route-preview";
import { notify } from "@/lib/notify";
import { playCeremony, ceremonyDock, initialsOf } from "@/lib/ceremony";
import { readUiPrefs } from "@/lib/ui-prefs";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { NameRecall } from "@/components/inventory/name-recall";
import { enterNext, focusFlow } from "@/lib/field-flow";

export const Route = createFileRoute("/nova-saida")({
  validateSearch: (s: Record<string, unknown>): { produto?: string; pav?: string; dest?: string; destPav?: string } => ({
    produto: typeof s.produto === "string" ? s.produto : undefined,
    pav: typeof s.pav === "string" ? s.pav : undefined,
    dest: typeof s.dest === "string" ? s.dest : undefined,
    destPav: typeof s.destPav === "string" ? s.destPav : undefined,
  }),
  component: NovaSaida,
});

function NovaSaida() {
  const { produto: produtoParam, pav: pavParam, dest: destParam, destPav: destPavParam } = Route.useSearch();
  const { perfil } = useSession();
  const navigate = useNavigate();
  const live = useDb();
  const mercadorias = live.listMercadorias(true);
  const destinos = live.listDestinos(true);
  const pavilhoes = live.listPavilhoes();
  const conta = readUiPrefs(perfil?.id ?? db.getSessionUser()?.id);
  const [origem, setOrigem] = useState(conta.pavilhaoPadraoId);
  const [mercadoriaId, setMercadoriaId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [destKind, setDestKind] = useState<"cliente" | "pav" | "saida">("cliente");
  const [somaDestino, setSomaDestino] = useState(true);
  const [desconta, setDesconta] = useState(true);
  const [destinoId, setDestinoId] = useState("");
  const [destPavId, setDestPavId] = useState("");
  const [horaSaida, setHoraSaida] = useState("");
  const [horaChegada, setHoraChegada] = useState("");
  const [observacao, setObservacao] = useState("");
  const [overConfirm, setOverConfirm] = useState(false);
  const skipOver = useRef(false);
  const [operador, setOperador] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [dNome, setDNome] = useState("");
  const [dCodigo, setDCodigo] = useState("");
  const [dEnd, setDEnd] = useState("");
  const [dContato, setDContato] = useState("");

  const mercadoria = mercadorias.find((m) => m.id === mercadoriaId) ?? null;
  const qtdLive = Number(quantidade) || 0;
  const origemId = resolvePavilhaoId(pavilhoes, origem) || origem;
  const origemOk = pavilhoes.some((p) => p.id === origemId);
  const noPav = mercadoria && origemOk ? live.stockAt(mercadoria.id, origemId) : 0;
  const baixa = desconta;
  const contaNoDestino = destKind === "pav" && somaDestino;
  const restantePav = baixa ? noPav - qtdLive : noPav;
  const restanteTotal = mercadoria ? (baixa && !contaNoDestino ? mercadoria.estoque - qtdLive : mercadoria.estoque) : 0;
  const destPav = pavilhoes.find((p) => p.id === destPavId) ?? null;
  const destPavStock = mercadoria && destPavId ? live.stockAt(mercadoria.id, destPavId) : 0;
  const overStock = baixa && !!mercadoria && origemOk && qtdLive > noPav;
  const lotes = mercadoriaId ? db.listFefoLotes(mercadoriaId) : [];
  const hs = completeTime(horaSaida);
  const hc = horaChegada.trim() ? completeTime(horaChegada) : "";
  const tempo = hs && hc && isValidTime(hs) && isValidTime(hc) ? calcTransportTime(hs, hc) : null;

  function pickProduto(id: string, item?: Mercadoria) {
    setMercadoriaId(id);
    if (item && !origem && item.pavilhao_id && pavilhoes.some((p) => p.id === item.pavilhao_id)) {
      setOrigem(item.pavilhao_id);
    }
  }

  useEffect(() => {
    if (!produtoParam) return;
    const m = mercadorias.find((x) => x.id === produtoParam || x.codigo === produtoParam);
    if (m) pickProduto(m.id, m);
  }, [produtoParam, mercadorias]);

  useEffect(() => {
    if (!pavParam) return;
    if (pavilhoes.some((p) => p.id === pavParam)) setOrigem(pavParam);
  }, [pavParam, pavilhoes]);

  useEffect(() => {
    if (!destParam) return;
    if (destinos.some((d) => d.id === destParam)) {
      setDestKind("cliente");
      setDestinoId(destParam);
    }
  }, [destParam, destinos]);

  useEffect(() => {
    if (!destPavParam) return;
    if (pavilhoes.some((p) => p.id === destPavParam)) {
      setDestKind("pav");
      setDestPavId(destPavParam);
    }
  }, [destPavParam, pavilhoes]);

  function reset() {
    setOrigem(readUiPrefs(perfil?.id).pavilhaoPadraoId);
    setMercadoriaId("");
    setQuantidade("");
    setDestKind("cliente");
    setDestinoId("");
    setDestPavId("");
    setHoraSaida("");
    setHoraChegada("");
    setObservacao("");
    setOperador("");
  }

  async function save() {
    if (!origemOk) {
      notify.error("Selecione de onde o produto está saindo.");
      return false;
    }
    if (!mercadoria) {
      notify.error("Busque e selecione o produto.");
      return false;
    }
    if (destKind === "cliente" && !destinoId) {
      notify.error("Escolha o cliente de destino.");
      return false;
    }
    if (destKind === "pav" && !destPavId) {
      notify.error("Escolha o pavilhão de destino.");
      return false;
    }
    if (destKind === "pav" && destPavId === origemId) {
      notify.error("Origem e destino não podem ser o mesmo lugar.");
      return false;
    }
    const qtd = Number(quantidade);
    if (!qtd || qtd <= 0) {
      notify.error("Informe uma quantidade válida.");
      return false;
    }
    const saidaHora = completeTime(horaSaida);
    const chegadaHora = horaChegada.trim() ? completeTime(horaChegada) : "";
    if (!isValidTime(saidaHora)) {
      notify.error("Informe a hora de saída com 4 dígitos, tipo 0000 ou 0300.");
      return false;
    }
    if (chegadaHora && !isValidTime(chegadaHora)) {
      notify.error("Hora de chegada inválida. Use 4 dígitos, tipo 0300.");
      return false;
    }
    if (baixa && qtd > noPav) {
      if (perfil?.nivel_acesso !== "admin") {
        const pav = pavilhoes.find((p) => p.id === origemId);
        notify.error(`Quantidade superior ao estoque disponível. No ${pav ? pavTitle(pav) : "pavilhão"} só tem ${formatNumber(noPav)} ${mercadoria.unidade}.`);
        return false;
      }
      if (!skipOver.current) {
        setOverConfirm(true);
        return false;
      }
    }
    if (!perfil) return false;
    await hydrateFromCloud();
    const fefo = lotes.find((l) => loteStatus(l.validade) !== "vencido" && l.quantidade > 0 && (!origemId || l.pavilhao_id === origemId));
    const pav = pavilhoes.find((p) => p.id === origemId);
    const dest = destinos.find((d) => d.id === destinoId);
    const destPavRow = pavilhoes.find((p) => p.id === destPavId);
    const origemNome = pav ? pavTitle(pav) : origemId;
    const somente = destKind === "saida";
    const destNome = somente ? "Sem destino" : destKind === "pav" ? (destPavRow ? pavTitle(destPavRow) : "pavilhão") : dest?.nome ?? "destino";
    const transfer = destKind === "pav";
    const stamps = arrivalStamp(todayISO(), saidaHora, chegadaHora || saidaHora);
    const tempoMin = chegadaHora ? calcTransportTime(saidaHora, chegadaHora) : null;
    try {
      db.createSaida({
        data: todayISO(),
        origem: origemId,
        mercadoria_id: mercadoria.id,
        quantidade: qtd,
        unidade: mercadoria.unidade,
        destino_id: transfer || somente ? "" : destinoId,
        destino_pavilhao_id: transfer ? destPavId : undefined,
        somente_saida: somente || undefined,
        soma_destino: transfer ? somaDestino : undefined,
        hora_saida: saidaHora,
        hora_chegada: chegadaHora || null,
        data_hora_saida: stamps.stampSaida,
        data_hora_chegada: chegadaHora ? stamps.stampChegada : null,
        tempo_transporte: tempoMin,
        usuario_id: perfil.id,
        lote_codigo: baixa ? fefo?.codigo : undefined,
        pavilhao: origemId,
        pavilhao_id: origemId,
        desconta_estoque: baixa,
        operador_nome: operador.trim() || undefined,
        observacao: observacao.trim() || undefined,
        permitir_negativo: baixa && qtd > noPav && perfil.nivel_acesso === "admin",
        status: transfer ? (chegadaHora ? "entregue" : "em_transito") : "registrada",
      });
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível registrar a saída.");
      return false;
    }
    playCeremony({
      kind: "dispatch",
      title: mercadoria.nome,
      subtitle: `${formatNumber(qtd)} ${mercadoria.unidade} · ${somente ? `${origemNome} · sem destino` : `${origemNome} → ${destNome}`}`,
      productName: mercadoria.nome,
      mark: "product",
      dock: ceremonyDock("/historico"),
      fromLabel: origemNome,
      toLabel: destNome,
      fromTime: saidaHora,
      toTime: chegadaHora || undefined,
      desconta: baixa,
      fromLogo: pav ? logoOfPavilhao(pav) : undefined,
      toLogo: transfer && destPavRow ? logoOfPavilhao(destPavRow) : undefined,
      transfer,
    });
    notify.success(
      transfer
        ? !baixa
          ? "Transferência registrada. Estoque intacto."
          : somaDestino
            ? "Transferência registrada. Estoque mudou de pavilhão."
            : "Registrado. Saiu da origem e ficou anotado no destino, sem somar a quantidade."
        : baixa
          ? somente
            ? "Saída registrada. Estoque baixado, sem destino."
            : "Saída registrada. Estoque baixado."
          : "Saída registrada. Estoque intacto.",
    );
    setOverConfirm(false);
    skipOver.current = false;
    const wait = prefersReducedMotion() ? 0 : baixa ? 1350 : 950;
    window.setTimeout(() => void navigate({ to: "/historico" }), wait);
    return true;
  }

  function createDest() {
    if (!dNome.trim()) {
      notify.error("Informe o nome do destino.");
      return;
    }
    const createdName = dNome.trim();
    const d = db.createDestino({ nome: dNome, codigo: dCodigo, endereco: dEnd, contato: dContato });
    setDestinoId(d.id);
    setNewOpen(false);
    setDNome("");
    setDCodigo("");
    setDEnd("");
    setDContato("");
    playCeremony({
      kind: "create",
      title: createdName,
      subtitle: "Cliente no cadastro",
      initials: initialsOf(createdName),
      mark: "client",
      dock: ceremonyDock("/clientes"),
    });
    notify.success("Cliente cadastrado.");
  }

  return (
    <PageStage className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        clip="/lottie/caminhao.json"
        title="Nova saída"
        description="Busque o produto, diga de onde sai e a que horas. Pode ir para um cliente ou para outro pavilhão."
      />
      <RoutePreview
        origem={origemOk ? pavTitle(pavilhoes.find((p) => p.id === origemId) ?? { codigo: "" }) : null}
        destino={destKind === "pav" ? (destPav ? pavTitle(destPav) : null) : destKind === "cliente" ? (destinos.find((d) => d.id === destinoId)?.nome ?? null) : "Sem destino"}
        destinoTipo={destKind}
        produto={mercadoria?.nome ?? null}
        quantidade={qtdLive}
        unidade={mercadoria?.unidade}
      />
      <Card>
        <CardHeader>
          <CardTitle>Dados da expedição</CardTitle>
          <CardDescription>Quatro dígitos viram hora: 0000 é meia-noite, 0300 é 03:00. Tudo fica no histórico.</CardDescription>
        </CardHeader>
        <CardContent className="saida-flow grid gap-4 sm:grid-cols-2" data-flow="saida">
          <div className="sf-origem space-y-2 sm:col-span-2">
            <Label>Saindo de</Label>
            <PavPicker
              items={pavilhoes}
              value={origemId}
              flowStep={1}
              onAdvance={() => focusFlow(document.getElementById("busca-prod-saida"), 2)}
              onChange={(id) => {
                setOrigem(id);
                if (destPavId === id) setDestPavId("");
              }}
              stockOf={mercadoria ? (id) => live.stockAt(mercadoria.id, id) : undefined}
              unidade={mercadoria?.unidade}
            />
            {!origemOk ? <p className="text-xs text-muted-foreground">Toque no pavilhão ou galpão de origem.</p> : null}
          </div>
          <div className="sf-produto space-y-2 sm:col-span-2">
            <Label htmlFor="busca-prod-saida">Mercadoria</Label>
            <ProductPicker items={mercadorias} value={mercadoriaId} onChange={pickProduto} flowStep={2} />
            {mercadoria ? (
              <StockSplit mercadoriaId={mercadoria.id} highlightId={origemOk ? origemId : undefined} delta={origemOk && baixa ? -qtdLive : 0} className="mt-2" />
            ) : null}
          </div>
          <div className="sf-qtd space-y-2">
            <Label htmlFor="qtd">Quantidade</Label>
            <Input id="qtd" data-step={3} type="number" min={0} step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} onKeyDown={(e) => enterNext(e)} />
            {mercadoria ? <p className="text-xs text-muted-foreground">{mercadoria.unidade}</p> : null}
          </div>
          <div className="sf-hs space-y-2">
            <Label htmlFor="hora-saida">Horário de saída</Label>
            <TimeField id="hora-saida" flowStep={4} value={horaSaida} onChange={setHoraSaida} aria-label="Horário de saída" />
            <p className="text-xs text-muted-foreground">Hora em que saiu da origem. Digite 4 dígitos — 0835 vira 08:35.</p>
          </div>
          <div className="sf-hc space-y-2">
            <Label htmlFor="hora-chegada">Horário de chegada</Label>
            <TimeField id="hora-chegada" flowStep={5} value={horaChegada} onChange={setHoraChegada} aria-label="Horário de chegada" />
            <p className="text-xs text-muted-foreground">Opcional. Se ainda não chegou, deixe em branco — a tabela mostra “Aguardando chegada”.</p>
          </div>
          <p className="sf-tempo sm:col-span-2 text-sm text-muted-foreground">
            Tempo de transporte: <span className="font-medium text-foreground">{formatMinutes(tempo)}</span>
          </p>
          <div className="sf-emp sm:col-span-2">
            <NameRecall
              id="operador"
              label="Empilhador"
              value={operador}
              onChange={setOperador}
              names={live.listOperadores()}
              flowStep={6}
              placeholder="Escreva ou toque no nome em cima"
              hint="Os nomes cadastrados ficam em cima da caixa. Pode escrever — a lista filtra na hora."
            />
          </div>
          <div className="sf-obs space-y-2 sm:col-span-2">
            <Label htmlFor="obs-saida">Observação</Label>
            <textarea
              id="obs-saida"
              data-step={7}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              onKeyDown={(e) => enterNext(e)}
              rows={3}
              placeholder="Anota o que precisar: palete, avaria, recado da expedição…"
              className="min-h-20 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {mercadoria && origemOk ? (
            <div
              className={cn(
                "sf-preview sm:col-span-2 rounded-2xl border p-4",
                overStock ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {pavTitle(pavilhoes.find((p) => p.id === origemId) ?? { codigo: "" })}
              </p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tem agora neste lugar</span>
                  <span className="tabular font-medium">
                    {formatNumber(noPav)} {mercadoria.unidade}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Saindo</span>
                  <span className="tabular font-medium">{qtdLive > 0 ? `− ${formatNumber(qtdLive)}` : "—"}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/80 pt-2">
                  <span className="font-medium">Vai ficar neste lugar</span>
                  <span className={cn("tabular text-lg font-semibold", overStock ? "text-destructive" : "text-foreground")}>
                    {formatNumber(Math.max(0, restantePav))} {mercadoria.unidade}
                  </span>
                </div>
                {overStock ? (
                  <p className="text-xs text-destructive">
                    Falta {formatNumber(qtdLive - noPav)} neste pavilhão. Total da empresa: {formatNumber(mercadoria.estoque)}.
                  </p>
                ) : qtdLive > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {destKind === "pav"
                      ? !baixa
                        ? `Só registro. ${destPav ? pavTitle(destPav) : "O destino"} continua com ${formatNumber(destPavStock)}. O estoque não muda.`
                        : somaDestino
                          ? `Vai para ${destPav ? pavTitle(destPav) : "o destino"}: ${formatNumber(destPavStock)} → ${formatNumber(destPavStock + qtdLive)}. Total da empresa permanece ${formatNumber(mercadoria.estoque)}.`
                          : `Sai deste lugar e fica registrado em ${destPav ? pavTitle(destPav) : "o destino"}, sem somar. Lá continua ${formatNumber(destPavStock)}. Total da empresa: ${formatNumber(mercadoria.estoque)} → ${formatNumber(Math.max(0, restanteTotal))}.`
                      : destKind === "saida"
                        ? baixa
                          ? `Sem destino. O estoque deste lugar e o total da empresa baixam: ${formatNumber(mercadoria.estoque)} → ${formatNumber(Math.max(0, restanteTotal))}.`
                          : "Sem destino. Só o registro. O estoque não muda."
                        : baixa
                          ? `Total da empresa: ${formatNumber(mercadoria.estoque)} → ${formatNumber(Math.max(0, restanteTotal))}`
                          : "Só o registro. O estoque não muda."}
                  </p>
                ) : null}
              </div>
            </div>
          ) : mercadoria ? (
            <p className="sf-preview sm:col-span-2 text-sm text-muted-foreground">Escolha de onde sai para ver quanto tem em cada pavilhão.</p>
          ) : null}
          <div className="sf-baixa space-y-2 sm:col-span-2">
            <Label>Estoque</Label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setDesconta(true)} className={cn("h-9 rounded-full border px-3 text-sm font-medium", desconta ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
                Descontar
              </button>
              <button type="button" onClick={() => setDesconta(false)} className={cn("h-9 rounded-full border px-3 text-sm font-medium", !desconta ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
                Não descontar
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {desconta ? "A quantidade sai do estoque deste lugar." : "Fica só o registro. O número do estoque não muda."}
            </p>
          </div>
          <div className="sf-dest-kind space-y-2 sm:col-span-2">
            <Label>Destino</Label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setDestKind("cliente")} className={cn("h-9 rounded-full border px-3 text-sm font-medium", destKind === "cliente" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
                Cliente
              </button>
              <button type="button" onClick={() => setDestKind("pav")} className={cn("h-9 rounded-full border px-3 text-sm font-medium", destKind === "pav" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
                Outro pavilhão
              </button>
              <button type="button" onClick={() => setDestKind("saida")} className={cn("h-9 rounded-full border px-3 text-sm font-medium", destKind === "saida" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
                Sem destino
              </button>
            </div>
          </div>
          {destKind === "pav" ? (
            <div className="sf-dest space-y-2 sm:col-span-2">
              <Label>Chegando em</Label>
              <PavPicker
                items={pavilhoes}
                value={destPavId}
                flowStep={8}
                onAdvance={() => focusFlow(document.getElementById("qtd"), 9)}
                onChange={setDestPavId}
                excludeId={origemOk ? origemId : undefined}
                stockOf={mercadoria ? (id) => live.stockAt(mercadoria.id, id) : undefined}
                unidade={mercadoria?.unidade}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button type="button" onClick={() => setSomaDestino(true)} className={cn("h-9 rounded-full border px-3 text-sm font-medium", somaDestino ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
                  Somar no destino
                </button>
                <button type="button" onClick={() => setSomaDestino(false)} className={cn("h-9 rounded-full border px-3 text-sm font-medium", !somaDestino ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
                  Só registrar, sem somar
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {!desconta
                  ? "Sem descontar, origem e destino ficam com o mesmo número. O lançamento só registra o caminho."
                  : somaDestino
                    ? "A quantidade sai da origem e entra na numeração do destino."
                    : "A quantidade sai da origem e baixa o total. Fica registrado que veio para este lugar, mas o número daqui não sobe."}
              </p>
            </div>
          ) : destKind === "saida" ? (
            <p className="sf-dest sm:col-span-2 rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
              {desconta ? "O estoque baixa deste lugar. Cliente e pavilhão ficam em branco." : "Só o registro. O estoque não muda e o destino fica em branco."}
            </p>
          ) : (
          <div className="sf-dest space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label>Cliente</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setNewOpen(true)}>
                <Plus /> Novo
              </Button>
            </div>
            <Select
              value={destinoId}
              onValueChange={(id) => {
                setDestinoId(id);
                window.setTimeout(() => focusFlow(document.getElementById("qtd"), 9), 0);
              }}
            >
              <SelectTrigger data-step={8} data-open-select="1">
                <SelectValue placeholder="Cliente / destino" />
              </SelectTrigger>
              <SelectContent>
                {destinos.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}
          <div className="sf-actions flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                try {
                  if (!origemOk) {
                    notify.error("Escolha de onde sai para salvar o atalho.");
                    return;
                  }
                  if (destKind === "pav") {
                    const row = db.createAtalho({
                      kind: "transferencia",
                      origem_pavilhao_id: origemId,
                      destino_pavilhao_id: destPavId,
                      mercadoria_id: mercadoriaId || undefined,
                    });
                    notify.success(`Atalho “${row.nome}” na lista de Hoje.`);
                    return;
                  }
                  if (destKind === "saida") {
                    notify.error("Saída sem destino não vira atalho. Escolha cliente ou outro pavilhão para salvar o caminho.");
                    return;
                  }
                  if (!destinoId) {
                    notify.error("Escolha o cliente para salvar o atalho.");
                    return;
                  }
                  const row = db.createAtalho({
                    kind: "saida",
                    origem_pavilhao_id: origemId,
                    destino_id: destinoId,
                    mercadoria_id: mercadoriaId || undefined,
                  });
                  notify.success(`Atalho “${row.nome}” na lista de Hoje.`);
                } catch (err) {
                  notify.error(err instanceof Error ? err.message : "Não foi possível salvar o atalho.");
                }
              }}
            >
              <BookmarkPlus /> Salvar atalho
            </Button>
            <Button variant="outline" type="button" onClick={reset}>
              <RotateCcw /> Limpar
            </Button>
            <ActionButton type="button" data-step={9} idleLabel="Registrar saída" pendingLabel="Registrando" doneLabel="Registrada" onAction={save} disabled={!origemOk || !mercadoria} />
          </div>
        </CardContent>
      </Card>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Novo cliente
            </DialogTitle>
            <DialogDescription>Cadastre o mercado ou o local de entrega.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dn">Nome</Label>
              <Input id="dn" value={dNome} onChange={(e) => setDNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dc">Código</Label>
              <Input id="dc" value={dCodigo} onChange={(e) => setDCodigo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="de">Endereço</Label>
              <Input id="de" value={dEnd} onChange={(e) => setDEnd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dt">Contato</Label>
              <Input id="dt" value={dContato} onChange={(e) => setDContato(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createDest}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={overConfirm}
        onOpenChange={(v) => {
          setOverConfirm(v);
          if (!v) skipOver.current = false;
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quantidade acima do estoque</DialogTitle>
            <DialogDescription>
              No pavilhão só existem {formatNumber(noPav)} {mercadoria?.unidade ?? ""}. Confirmar esta exceção baixa mesmo assim e o administrador fica registrado no log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                skipOver.current = false;
                setOverConfirm(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                skipOver.current = true;
                setOverConfirm(false);
                void save();
              }}
            >
              Autorizar baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageStage>
  );
}
