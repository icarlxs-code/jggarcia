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

(seções seguintes preenchidas conforme as fases avançam)
