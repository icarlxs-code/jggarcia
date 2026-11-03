import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, ImagePlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { notify } from "@/lib/notify";
import { formatNumber } from "@/lib/format";
import type { Pavilhao } from "@/lib/types";
import { TIPOS_LUGAR } from "@/lib/constants";
import { pavTitle } from "@/lib/catalog";
import { readLogoAsset } from "@/lib/reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { CountUp } from "@/components/motion/count-up";
import { PageStage } from "@/components/motion/page-stage";
import { playCeremony, ceremonyDock } from "@/lib/ceremony";
import { PavMark } from "@/components/inventory/pav-mark";
import { useQueuedEdit } from "@/lib/ctx-edit";
import { cn, fold } from "@/lib/utils";

export const Route = createFileRoute("/pavilhoes")({ component: Pavilhoes });

function Pavilhoes() {
  const live = useDb();
  const list = live.listPavilhoes(true);
  const produtos = live.listMercadorias(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Pavilhao | null>(null);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [logo, setLogo] = useState("");
  const [pngInfo, setPngInfo] = useState<{ png: boolean; transparent: boolean } | null>(null);
  const [ativo, setAtivo] = useState(true);
  const [drop, setDrop] = useState<Pavilhao | null>(null);
  const [tipoQ, setTipoQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useQueuedEdit("pavilhao", (id) => {
    const p = list.find((x) => x.id === id);
    if (p) startEdit(p);
  });

  const tiposFiltrados = useMemo(() => {
    const term = fold(tipoQ.trim());
    if (!term) return [...TIPOS_LUGAR];
    return TIPOS_LUGAR.filter((t) => fold(t).includes(term));
  }, [tipoQ]);

  function startNew() {
    setEdit(null);
    setCodigo("");
    setNome("");
    setTipo("");
    setLogo("");
    setPngInfo(null);
    setTipoQ("");
    setAtivo(true);
    setOpen(true);
  }

  function startEdit(p: Pavilhao) {
    setEdit(p);
    setCodigo(p.codigo);
    setNome(p.nome);
    setTipo(p.tipo || "");
    setLogo(p.logo || "");
    setPngInfo(p.logo?.startsWith("data:image/png") ? { png: true, transparent: true } : null);
    setTipoQ("");
    setAtivo(p.ativo);
    setOpen(true);
  }

  async function onPickPhoto(file: File) {
    try {
      const asset = await readLogoAsset(file);
      setLogo(asset.dataUrl);
      setPngInfo({ png: asset.png, transparent: asset.transparent });
      if (asset.png && asset.transparent) notify.success("PNG com fundo transparente reconhecido.");
      else if (asset.png) notify.success("PNG reconhecido.");
      else notify.success("Foto carregada.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não deu para ler a foto.");
    }
  }

  function save() {
    if (!codigo.trim()) {
      notify.error("Informe o código do lugar.");
      return;
    }
    const tipoFinal = tipo.trim();
    const nomeFinal = nome.trim() || (tipoFinal ? `${tipoFinal} ${codigo.trim()}` : codigo.trim());
    if (edit) {
      db.updatePavilhao(edit.id, {
        codigo: codigo.trim(),
        nome: nomeFinal,
        tipo: tipoFinal,
        logo,
        ativo,
      });
      notify.success("Lugar atualizado.");
    } else {
      db.createPavilhao({
        codigo: codigo.trim(),
        nome: nomeFinal,
        tipo: tipoFinal,
        logo,
        ativo,
      });
      notify.success("Lugar cadastrado.");
      playCeremony({
        kind: "create",
        title: nomeFinal,
        subtitle: "No mapa da operação",
        mark: "store",
        dock: ceremonyDock("/pavilhoes"),
      });
    }
    setOpen(false);
  }

  return (
    <PageStage className="space-y-4">
      <PageHeader
        clip="/lottie/galpao.json"
        clipClassName="lottie-clip h-14 w-24 shrink-0"
        title="Pavilhões"
        description="Estoque real de cada lugar: pavilhão, galpão, carreta, câmara, doca… Conte o que tem no chão e corrija se não bater."
      >
        <Button asChild variant="outline">
          <Link to="/contagem">
            <ClipboardCheck /> Nova contagem
          </Link>
        </Button>
        <Button onClick={startNew}>
          <Plus /> Novo lugar
        </Button>
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p, _i, todos) => {
          const comSaldo = produtos.filter((m) => live.stockAt(m.id, p.id) > 0);
          const totalItens = comSaldo.reduce((a, m) => a + live.stockAt(m.id, p.id), 0);
          // Share of the company's volume held in this place (same units summed as on the card).
          const volumeEmpresa = todos.reduce((acc, pv) => acc + produtos.reduce((a, m) => a + Math.max(0, live.stockAt(m.id, pv.id)), 0), 0);
          const parte = volumeEmpresa > 0 ? totalItens / volumeEmpresa : 0;
          const title = pavTitle(p);
          return (
            <Card key={p.id} data-ctx="pavilhao" data-id={p.id} data-nome={title} className={cn("pav-card glyph-host", !p.ativo && "opacity-70")}>
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="text-base leading-tight">{title}</CardTitle>
                  {p.nome && p.nome !== title ? <p className="mt-1 text-sm text-muted-foreground">{p.nome}</p> : null}
                </div>
                <PavMark p={p} size="lg" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="kpi-figure text-3xl leading-none">
                    <CountUp value={comSaldo.length} />
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    produtos com saldo · {formatNumber(totalItens)} volumes
                  </p>
                </div>
                <div className="pav-share" title="Parte do volume total da empresa que está neste lugar">
                  <span className="pav-share-bar" aria-hidden="true">
                    <i style={{ width: `${(parte * 100).toFixed(1)}%` }} />
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{Math.round(parte * 100)}% do volume da empresa</span>
                </div>
                <div className="space-y-2">
                  <Badge variant={p.ativo ? "success" : "muted"}>{p.ativo ? "Operação ativa" : "Inativo"}</Badge>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/contagem" search={{ pav: p.id }}>
                        Contar
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        db.updatePavilhao(p.id, { ativo: !p.ativo });
                        notify.success(p.ativo ? "Lugar desativado." : "Lugar ativado.");
                      }}
                    >
                      {p.ativo ? "Desativar" : "Ativar"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDrop(p)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{edit ? "Editar lugar" : "Novo lugar"}</DialogTitle>
            <DialogDescription>O tipo é opcional. Pode deixar só o código e o nome. PNG mantém o fundo transparente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="logo-check relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border"
                aria-label="Enviar foto"
              >
                {logo ? (
                  <img src={logo} alt="" className="h-full w-full object-contain" />
                ) : (
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                )}
              </button>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label>Foto</Label>
                <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP. Se for PNG, o fundo transparente é preservado.</p>
                {pngInfo?.png ? (
                  <Badge variant={pngInfo.transparent ? "success" : "secondary"}>
                    {pngInfo.transparent ? "PNG · fundo transparente" : "PNG reconhecido"}
                  </Badge>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="h-3.5 w-3.5" />
                    Enviar foto
                  </Button>
                  {logo ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setLogo("");
                        setPngInfo(null);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </Button>
                  ) : null}
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void onPickPhoto(file);
                }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pc">Código</Label>
                <Input id="pc" placeholder="11, 00, 74…" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pn">Nome (opcional)</Label>
                <Input id="pn" placeholder={tipo ? `${tipo} ${codigo || ""}`.trim() : codigo || "Nome livre"} value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tipo-busca">Tipo de lugar (opcional)</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tipo-busca"
                  value={tipoQ}
                  onChange={(e) => setTipoQ(e.target.value)}
                  placeholder="Buscar: carreta, câmara, doca…"
                  className="pl-9"
                />
              </div>
              <div className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-border p-1 sm:grid-cols-3">
                {tiposFiltrados.length === 0 ? (
                  <p className="col-span-full px-2 py-6 text-center text-xs text-muted-foreground">Nenhum tipo com esse nome.</p>
                ) : (
                  tiposFiltrados.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipo((cur) => (cur === t ? "" : t))}
                      className={cn(
                        "min-h-9 rounded-lg px-2 py-1.5 text-left text-xs font-medium leading-tight",
                        tipo === t ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                      )}
                    >
                      {t}
                    </button>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {tipo ? (
                  <>
                    Selecionado: <span className="font-medium text-foreground">{tipo}</span>
                    {codigo.trim() ? ` · vai aparecer como ${nome.trim() || `${tipo} ${codigo.trim()}`}` : ". Toque de novo para tirar."}
                  </>
                ) : (
                  "Nenhum tipo. O lugar aparece pelo nome ou só pelo código."
                )}
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 accent-primary" />
              Operação ativa
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>{edit ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!drop} onOpenChange={(v) => !v && setDrop(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {drop ? pavTitle(drop) : "lugar"}</DialogTitle>
            <DialogDescription>
              O lugar sai das listas, dos filtros e dos lançamentos novos. O histórico antigo permanece. Essa exclusão não volta sozinha.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDrop(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!drop) return;
                db.deletePavilhao(drop.id);
                notify.success("Lugar excluído.");
                setDrop(null);
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageStage>
  );
}