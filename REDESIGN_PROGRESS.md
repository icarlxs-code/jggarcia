# Operação Nova Geração — progresso do redesign

Documento vivo. Se o contexto acabar, retome daqui. Branch: `feat/nova-geracao` (a partir da `main` 7c56d9d).

## Regras que não mudam

- Preservar regras de negócio, dados, autenticação, permissões (`adminOnly`, `operadorPodeVer`), integrações (nuvem, IndexedDB, PDF, QR, empilhadores) e contratos de `src/lib/store.ts`.
- Nada de números inventados: todo indicador vem de `db.*` (store) ou de cálculo sobre ele.
- Todo movimento passa por `html.motion-on` (preferência "Animações" por conta; respeita o Windows em "Seguir o Windows").
- Cada fase termina com commit; dá para voltar a qualquer ponto pelo git.

## Fase 1 — Auditoria (concluída)

### Stack
- TanStack Start (React 19, Vite 8, Nitro) · Tailwind v4 · Radix · recharts · gsap · lottie-web · motion 14 · NumberFlow · AutoAnimate · Lenis · three + React Three Fiber 9 + drei + postprocessing · sonner · cmdk · fuse.js.
- Dados: `src/lib/store.ts` (memória + localStorage/IndexedDB + nuvem `cloud-store.server.ts`), sessão em `auth-store.server.ts`.
- Testes: `npm test` (55 testes, node:test). Build: `vite build` (Nitro → Vercel).

### Rotas e módulos (27 telas)
| Grupo | Rota | Módulo | Propósito |
|---|---|---|---|
| Operação | `/hoje` | Hoje | Cockpit do dia: entradas, saídas, em trânsito, contagens do período |
| Operação | `/` | Visão geral | Painel: estoque total, armazém 3D, radar, saúde, fluxo 7 dias |
| Operação | `/entradas` | Entradas | Recebimento (estoque sobe) e histórico de entradas |
| Operação | `/historico` | Saídas | Consulta e soma das saídas (somente leitura) |
| Operação | `/nova-saida` | Nova saída | Expedição: origem → cliente ou outro pavilhão, horários |
| Operação | `/movimentacoes` | Movimentações | Linha do tempo: entradas, saídas, transferências, contagens |
| Operação | `/estoque` | Estoque | Saldo por produto/local, situação, ações do estoque |
| Operação | `/contagem` | Contagem | Conferência física por produto e local, histórico |
| Operação | `/lotes` | Lotes | Validade/FEFO |
| Cadastros | `/mercadorias` | Produtos | Catálogo |
| Cadastros | `/produto/$id` | Perfil do produto | Estoque por pavilhão, leitura do produto |
| Cadastros | `/clientes`, `/clientes/$id`, `/destinos`→clientes | Clientes | Destinos da expedição, ranking do mês |
| Cadastros | `/fornecedores` | Fornecedores | Origem das entradas |
| Cadastros | `/empilhadores`, `/central-empilhadores` | Empilhadores | Equipe de carga, transportes, localização |
| Cadastros | `/pavilhoes` | Pavilhões | Locais físicos e seus saldos |
| Gestão | `/auditoria` | Log de alterações | Tudo que foi lançado/alterado, com desfazer |
| Gestão | `/relatorios` | Relatórios | PDFs do dia, por produto, pavilhão, empilhador, cliente |
| Gestão | `/analises` | Gráficos e análises | Leitura visual dos lançamentos |
| Gestão | `/fretes` | Pagamento de fretes | Comprovante com PDF em tempo real (financeiro) |
| Gestão | `/despesas-frete` | Despesa de frete | Mesma tela de fretes, tipo "despesa" (financeiro) |
| Gestão | `/requisicoes` | Requisição de fornecedor | Pedidos com número de série único |
| Gestão | `/usuarios` | Equipe | Contas, perfis, celulares vinculados |
| Gestão | `/configuracoes` | Configurações | Preferências por conta (tema, animações, limites) |
| Fora do menu | `/operar` | App do empilhador | Celular do operador: vincular e lançar |
| Fora do menu | `/qr-acesso` | Acesso por QR | Login no celular |

### Problemas de UX encontrados
1. Ícones genéricos e repetidos: o mesmo caminhão em Fornecedores, Pagamento e Despesa de frete; o mesmo "log" em Movimentações, Log e Requisição; o mesmo gráfico em Relatórios e Análises; o mesmo "users" em Empilhadores e Equipe.
2. Animação de ícone única (o ícone inteiro pula/gira), igual para todos.
3. Todas as telas têm o mesmo cabeçalho com a mesma animação Lottie (galpão, caixa, caminhão) — nenhuma identidade por módulo.
4. Menu com 20 itens planos, sem cor nem forma que diferencie as áreas; rótulos longos truncam.
5. Estados vazios idênticos em todas as telas.
6. Toasts com ícones estáticos.
7. Botões sem estado de carregamento/sucesso.
8. Título interno de Fretes ("Nota do comprovante em tempo real") diferente do item do menu.

## Fase 2 — Pesquisa e direção de arte

### Bibliotecas avaliadas
| Recurso | Decisão | Motivo |
|---|---|---|
| Motion | Usar (já instalado) | Layout animations (pill do menu), AnimatePresence, springs |
| GSAP | Usar (já instalado) | Entrada em cascata das telas (PageStage), timelines |
| AutoAnimate | Usar (já instalado) | Listas que mudam |
| NumberFlow | Usar (já instalado) | Números que rolam |
| Lottie | Reduzir | Clips genéricos substituídos por glifos SVG próprios por módulo |
| Rive | Não agora | Exige arquivos .riv feitos no editor; sem assets próprios |
| Theatre.js | Não | Ferramenta de autoria cinematográfica; peso alto para app operacional |
| React Spring | Não | Sobreposição com Motion |
| Lucide | Manter para ícones de interface | Traço consistente com os glifos próprios |
| Phosphor / Iconoir | Não | Mudaria o traço sem ganho; glifos de domínio (caixa, empilhadeira, pallet) não existem com animação |
| pqoqubbw/icons (lucide animados) | Referência de padrão | Estados por hover com Motion; o domínio de hortifrúti/armazém não existe lá |
| Lordicon | Não | Ícones Lottie pesados e licença com atribuição |
| Magic UI / Aceternity / Motion Primitives / Cult UI / React Bits / Origin UI / UIverse | Referência de padrões | Padrões (spotlight, border beam, number ticker, shimmer) recriados nos tokens do sistema em vez de copiar componentes com estética própria |
| shadcn/ui + Radix | Manter | Base acessível já usada |
| Three.js / R3F / drei / postprocessing | Manter, uso pontual | Armazém 3D, login, esfera do assistente |
| OGL / Houdini | Não | Sem ganho sobre R3F/CSS para os casos atuais |

### Direção de arte: "Safra — o pátio ao amanhecer"
O produto é a operação de hortifrúti no Ceasa: caixas, pavilhões, caminhões e frutas, trabalho que começa de madrugada. A identidade nasce daí:

- **Luz**: verde-floresta profundo (noite no pátio) que recebe uma luz âmbar de amanhecer. Cada módulo emite a própria luz ambiente.
- **Matéria**: papel quente (fundo), papel kraft das caixas, etiquetas carimbadas (códigos de produto), madeira dos pallets.
- **Cor de módulo**: cada área ganha uma cor tirada da própria safra (folha, tangerina, kraft, uva, berinjela, coco verde…). A cor marca ícone, luz ambiente, indicadores e estados vazios; a ação principal continua no verde da marca.
- **Tipografia**: Bricolage Grotesque (títulos e números grandes), Geist (interface), Geist Mono (códigos e quantidades em etiqueta).
- **Movimento**: físico e curto; molas nas interações, desaceleração exponencial nas entradas, cada ícone com movimento que conta o que ele faz.

## Fases 3–4 — Laboratório e sistema global (concluídas)

Commits `45a7c30`, `c383122`.

| Peça | Onde | O que faz |
|---|---|---|
| Registro de módulos | `src/lib/modules.ts` | 22 módulos: nome, luz, tinta, papel; `moduleForPath`, `useCurrentModule`, `moduleStyle` |
| Glifos | `src/components/brand/glyph.tsx` + CSS "SAFRA" em `styles.css` | Um glifo por módulo + busca, sino, assistente, sync; status (sucesso, erro, alerta, info, carregando). Hover = gesto completo; `live` = loop calmo; `state` = selo |
| Luz do módulo | `app-shell.tsx` (efeito em `pathname`) | `--mod`/`--mod-ink` no `<html>`, transição de 700 ms via `@property` |
| Cabeçalho de página | `page-header.tsx` | Selo com o glifo do módulo, linha inferior na cor do módulo |
| Estado vazio | `empty-state.tsx` | Palco com o glifo do módulo e órbita |
| Toasts | `ui/sonner.tsx` | Ícones de status que se desenham |
| Navegação | `app-shell.tsx` | Grupos recolhíveis (salvos), contador, item ativo pelo módulo, glifos coloridos, pill que desliza, textura de papel |
| Botões | `ui/button.tsx`, `motion/magnet-layer.tsx`, `ui/split-button.tsx` | `loading`, efeito magnético, botão dividido |
| Busca global | `search/command-palette.tsx` | Páginas e ações com glifo do módulo |
| Laboratório | `/design` (`routes/design.tsx`) | Referência viva: glifos, luzes, estados |

## Fase 5 — Redesign por módulo

| Módulo | Status | Componente/identidade |
|---|---|---|
| Visão geral | Feito | Selos de módulo nos números; armazém 3D; radar; saúde |
| Hoje | Feito | Sol nascendo no cabeçalho; glifo da área em cada número |
| Estoque | Feito | `StockMeter` (barra = 2× mínimo, marca no mínimo); botão dividido |
| Movimentações | Feito | Trilho e glifo por tipo (entrada/saída/transferência/contagem) |
| Nova saída | Feito | `RoutePreview` ao vivo (origem → destino, carga, caminhão) |
| Entradas | Feito | `DockStrip` (chegadas do dia, última, volume por unidade) |
| Pavilhões | Feito | Barra de participação no volume da empresa |
| Pagamento / Despesa de frete | Feito | `MoneyStrip` (total do mês, comprovantes, mês anterior) |
| Log de alterações | Feito | Glifo da área alterada por registro |
| Contagem | Feito | Barra de progresso própria com porcentagem, cartão na luz do módulo |
| Produtos (e todo o sistema) | Feito | Código de produto como etiqueta carimbada de caixa (assinatura) |
| Clientes, Fornecedores | Feito | `NameMark` com cor estável por nome (logos existentes têm prioridade) |
| Empilhadores, Equipe | Feito | `NameMark` redondo por pessoa |
| Lotes | Feito | Regras FEFO/janela/bloqueio com glifos |
| Relatórios | Feito | PDFs com glifo de documento |
| Requisições | Feito | Número de série em carimbo |
| Configurações | Feito | Cada grupo com o glifo do que afeta |
| Gráficos e análises | Feito (global) | Luz e glifo do módulo, estados vazios do módulo |

## Fases 6–7 — Refinamento e validação (concluídas)
- Celular (390×844): cabeçalho, cartão de rota compacto, abas inferiores com glifos.
- Modo escuro: selos e glifos com tinta clara derivada da luz do módulo.
- Limpeza: componente `AnimatedIcon` e 162 linhas de CSS dos ícones antigos removidos (tipo `IconMotion` mantido por compatibilidade de props).
- `tsc` sem erros · 55 testes · build de produção ok.
- Console sem erros percorrendo as 20 telas do menu numa aba limpa.
- Integridade: 132 produtos, 0 diferenças entre total e soma por pavilhão.

## Notas de validação
- O navegador de teste do app pinta a 1 quadro/s quando a janela está coberta (medido: quadros de ~1.000 ms; tarefas longas do app só 59–76 ms). Para inspecionar, adiantar animações finitas antes da foto.
- Erros "useSession precisa estar dentro do SessionProvider" no console aparecem só após recarga a quente de `store.ts`/`session.tsx`; somem em aba nova.

## Próximas etapas sugeridas
1. Ícones de tabela/linha restantes ainda em Lucide (editar, excluir, filtros) podem ganhar versões animadas no mesmo traço.
2. Gráficos (recharts) podem adotar a luz do módulo nas séries.
3. Magic MCP (21st.dev) segue pendente da API key do usuário.
