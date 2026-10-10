import { todayISO } from "@/lib/format";
import { db } from "@/lib/store";

function mes(offset: number) {
  const agora = new Date();
  const data = new Date(agora.getFullYear(), agora.getMonth() + offset, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function noMes(data: string | undefined, alvo: string) {
  return (data || "").slice(0, 7) === alvo;
}

function soma(rows: { quantidade?: number }[]) {
  return rows.reduce((total, row) => total + (Number(row.quantidade) || 0), 0);
}

function top(map: Map<string, number>, limite = 15) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, limite)
    .map(([nome, valor]) => `${nome}: ${valor}`)
    .join("; ");
}

function contar(chaves: string[]) {
  const mapa = new Map<string, number>();
  for (const chave of chaves) {
    const nome = chave.trim() || "sem nome";
    mapa.set(nome, (mapa.get(nome) || 0) + 1);
  }
  return top(mapa);
}

/** Retrato real do banco, sem senha, foto, CPF ou chave Pix. */
export function retratoOperacao(usuario: string): string {
  const hoje = todayISO();
  const este = mes(0);
  const passado = mes(-1);
  const produtos = db.listMercadorias(true);
  const movimentos = db.listSaidas();
  const entradas = movimentos.filter((s) => (s.tipo ?? "saida") === "entrada");
  const saidas = movimentos.filter((s) => (s.tipo ?? "saida") !== "entrada");
  const contagens = db.listContagens();
  const logs = db.listLogs();
  const fretes = db.listFretes();
  const pavilhoes = db.listPavilhoes(true);
  const pessoas = db.listEmpilhadores();
  const usuarios = db.exportUsers().map((u) => `${u.nome} (${u.email}, ${u.nivel_acesso}, ${u.status === false ? "inativo" : "ativo"})`);
  let transportes: string[] = [];
  try {
    transportes = db.listForkliftJobs().slice(0, 30).map((j) => {
      const quando = (j.started_at || "").slice(0, 16).replace("T", " ");
      return `${quando} ${j.operator_nome} ${j.product_nome} ${j.quantity} ${j.unit} ${j.origin_nome} → ${j.destination_nome} ${j.status}${j.photo ? " com foto" : ""}`;
    });
  } catch {
    transportes = [];
  }

  const contPassado = contagens.filter((c) => noMes(c.data || c.created_at, passado));
  const contEste = contagens.filter((c) => noMes(c.data || c.created_at, este));
  const contHoje = contagens.filter((c) => (c.data || c.created_at || "").slice(0, 10) === hoje);
  const entPassado = entradas.filter((s) => noMes(s.data, passado));
  const saiPassado = saidas.filter((s) => noMes(s.data, passado));
  const entEste = entradas.filter((s) => noMes(s.data, este));
  const saiEste = saidas.filter((s) => noMes(s.data, este));
  const entHoje = entradas.filter((s) => s.data === hoje);
  const saiHoje = saidas.filter((s) => s.data === hoje);

  const nomeProduto = new Map(produtos.map((m) => [m.id, `${m.codigo} ${m.nome}`]));
  const nomePav = new Map(pavilhoes.map((p) => [p.id, p.nome || p.codigo]));

  const linhas = [
    `Hoje é ${hoje}. Este mês é ${este}. O mês passado é ${passado}.`,
    `Quem pergunta: ${usuario}.`,
    `Produtos ativos: ${produtos.length}. Com foto: ${produtos.filter((m) => m.foto || m.foto_original).length}. Cadastrados hoje: ${produtos.filter((m) => (m.created_at || "").slice(0, 10) === hoje).length}. Cadastrados neste mês: ${produtos.filter((m) => noMes(m.created_at, este)).length}.`,
    `Catálogo: ${produtos.map((m) => `${m.codigo} ${m.nome} estoque ${m.estoque} ${m.unidade}`).join(" | ")}`,
    `Pavilhões e lugares: ${pavilhoes.map((p) => `${p.tipo || "lugar"} ${p.codigo} ${p.nome}${p.ativo === false ? " inativo" : ""}`).join(" | ") || "nenhum"}`,
    `Usuários: ${usuarios.join(" | ") || "nenhum"}`,
    `Empilhadores: ${pessoas.map((p) => p.nome).join(", ") || "nenhum"}`,
    `Contadores cadastrados: ${db.listContadores().join(", ") || "nenhum"}`,
    `CONTAGENS no total: ${contagens.length}. Hoje: ${contHoje.length}. Este mês (${este}): ${contEste.length}. Mês passado (${passado}): ${contPassado.length}.`,
    contPassado.length
      ? `Contagens do mês passado por pessoa: ${contar(contPassado.map((c) => c.contador || c.usuario_nome))}. Por lugar: ${contar(contPassado.map((c) => nomePav.get(c.pavilhao_id) || c.pavilhao_id))}. Por produto: ${contar(contPassado.map((c) => nomeProduto.get(c.mercadoria_id) || c.mercadoria_id))}.`
      : "Nenhuma contagem no mês passado.",
    `ENTRADAS no total: ${entradas.length}, quantidade ${soma(entradas)}. Hoje: ${entHoje.length} (${soma(entHoje)}). Este mês: ${entEste.length} (${soma(entEste)}). Mês passado: ${entPassado.length} (${soma(entPassado)}).`,
    `SAÍDAS no total: ${saidas.length}, quantidade ${soma(saidas)}. Hoje: ${saiHoje.length} (${soma(saiHoje)}). Este mês: ${saiEste.length} (${soma(saiEste)}). Mês passado: ${saiPassado.length} (${soma(saiPassado)}).`,
    `Saídas do mês passado por produto: ${contar(saiPassado.map((s) => s.mercadoria?.nome || nomeProduto.get(s.mercadoria_id) || "produto")) || "nenhuma"}.`,
    `Entradas do mês passado por produto: ${contar(entPassado.map((s) => s.mercadoria?.nome || nomeProduto.get(s.mercadoria_id) || "produto")) || "nenhuma"}.`,
    `Últimos lançamentos: ${movimentos.slice(0, 40).map((s) => `${s.data} ${(s.tipo ?? "saida") === "entrada" ? "entrada" : "saída"} ${s.mercadoria?.nome || "produto"} ${s.quantidade} ${s.unidade} ${s.pavilhao || s.origem || ""} ${s.usuario?.nome || ""}`.trim()).join(" || ") || "nenhum"}`,
    `Últimas contagens: ${contagens.slice(0, 30).map((c) => `${(c.data || c.created_at).slice(0, 10)} ${nomeProduto.get(c.mercadoria_id) || "produto"} ${nomePav.get(c.pavilhao_id) || ""} contado ${c.contado} esperado ${c.esperado} por ${c.contador || c.usuario_nome}`).join(" || ") || "nenhuma"}`,
    `FRETES: ${fretes.length}. Valor somado: ${fretes.reduce((t, f) => t + (Number(f.valor) || 0), 0)}. Notas: ${fretes.slice(0, 25).map((f) => `${f.numero} ${f.data_entrada} ${f.fornecedor} ${f.pavilhao} R$ ${f.valor} ${f.motorista} ${f.status} ${f.observacoes || ""}`.trim()).join(" || ") || "nenhuma"}`,
    transportes.length ? `Transportes de empilhador: ${transportes.join(" || ")}` : "Nenhum transporte de empilhador registrado.",
    `LOG recente (${logs.length} no total): ${logs.slice(0, 40).map((l) => `${l.created_at.slice(0, 16).replace("T", " ")} ${l.usuario_nome} ${l.acao} ${l.entidade} ${l.resumo}`).join(" || ") || "nenhum"}`,
  ];
  return linhas.join("\n");
}
