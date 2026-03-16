// ─── Auth ─────────────────────────────────────────────────────────────────────
export type Perfil = "ANALISTA" | "GESTOR";

export interface Usuario {
    id: string;
    nome: string;
    email: string;
    perfil: Perfil;
    ativo: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface LoginRequest {
    email: string;
    senha: string;
}
export interface LoginResponse {
    token: string;
    usuario: Usuario;
}

// ─── Cliente / Contato ────────────────────────────────────────────────────────
export interface Cliente {
    id: string;
    nome: string;
    cidade: string;
    cpfCnpj: string;
    contatoPrincipal?: string;
    comercialResponsavel?: string;
    ativo: boolean;
    contatos?: Contato[];
    createdAt: string;
    updatedAt: string;
}

export interface Contato {
    id: string;
    nome: string;
    telefone: string;
    email?: string;
    ativo: boolean;
    pendenteVinculacao: boolean;
    clientes?: Cliente[];
    createdAt: string;
    updatedAt: string;
}

/**
 * Retornado por GET /api/contatos/pendentes e emitido via
 * WebSocket em /topic/contatos-pendentes.
 * DTO enxuto — apenas o necessário para o painel de triagem.
 */
export interface ContatoPendente {
    id: string;
    nome: string;
    telefone: string;
    createdAt: string;
}

// ─── Chamado ──────────────────────────────────────────────────────────────────
export type ChamadoStatus =
    | "AGUARDANDO"
    | "EM_ATENDIMENTO"
    | "AGUARDANDO_CLIENTE"
    | "ENCERRADO";

export type Categoria = "ERRO" | "DUVIDA";
export type Origem = "WHATSAPP" | "EMAIL" | "TELEFONE";

// NivelSla: NÃO faz parte do Chamado — usado apenas em eventos WebSocket
export type NivelSla = "ALERTA" | "CRITICO" | "ESCALADO";

export interface ChamadoStatusHistorico {
    id: string;
    status: ChamadoStatus;
    dtInicio: string;
    dtFim?: string;
    tempoEmStatusSegundos?: number;
    usuarioResponsavelId?: string;
    usuarioResponsavelNome?: string;
}

export interface Chamado {
    id: string;
    texto?: string;
    categoria?: Categoria;
    solucao?: string;
    statusAtual: ChamadoStatus;
    origem: Origem;
    dtAbertura: string;
    dtPrimeiraMensagem?: string;
    dtPrimeiraResposta?: string;
    dtEncerramento?: string;
    tempoTotalSegundos?: number;
    contatoId: string;
    contatoNome: string;
    usuarioResponsavelId?: string;
    usuarioResponsavelNome?: string;
    subtipoId?: string;
    createdAt?: string;
    updatedAt?: string;
    historico?: ChamadoStatusHistorico[];
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export type TipoMidia = "TEXTO" | "IMAGEM" | "AUDIO" | "VIDEO";
export type ChatOrigem = "CLIENTE" | "SUPORTE";

export interface Chat {
    id: string;
    chamadoId?: string;
    contatoId: string;
    nomeContato?: string;
    usuarioId?: string;
    origem: ChatOrigem;
    dtEnvio?: string;
    texto?: string;
    fileUrl?: string;
    tipoMidia?: TipoMidia;
    foneCliente?: string;
    foneSuporte?: string;
    nomeGrupo?: string;
    createdAt?: string;
}

/**
 * Retornado por GET /api/chat/fila/agrupada.
 * Representa um contato com mensagens pendentes de triagem,
 * com dados agregados calculados pelo banco (não pelo frontend).
 */
export interface FilaAgrupadaItem {
    contatoId: string;
    nomeContato: string;
    foneContato: string;
    /**
     * TRUE quando o contato ainda não foi vinculado a nenhum Cliente.
     * Neste caso, o botão "Criar Chamado" deve ser bloqueado até
     * o analista fazer a vinculação via tela de Contatos.
     */
    pendenteVinculacao: boolean;
    /** Total de mensagens sem chamado deste contato. */
    totalMensagens: number;
    /** Data da mensagem mais antiga — base para cálculo de SLA de triagem. */
    dtPrimeiraMensagem: string;
    /** Data da mensagem mais recente. */
    dtUltimaMensagem: string;
    /** Texto da última mensagem (null para áudio sem legenda). */
    ultimoTexto: string | null;
    /** Tipo de mídia da última mensagem — usado para exibir ícone adequado. */
    ultimoTipoMidia: TipoMidia | null;
}

export interface NotificacaoSla {
    chamadoId: string;
    nivel: NivelSla;
    mensagem: string;
    timestamp: string;
}

// ─── Tipo / Subtipo ───────────────────────────────────────────────────────────
export interface Subtipo {
    id: string;
    nome: string;
    ativo: boolean;
    tipo?: Tipo;
}
export interface Tipo {
    id: string;
    nome: string;
    ativo: boolean;
    subtipos?: Subtipo[];
}

// ─── Navegação ────────────────────────────────────────────────────────────────
export type View =
    | "dashboard"
    | "chat"
    | "chamados"
    | "clientes"
    | "contatos"
    | "usuarios"
    | "tipos";

export interface PageResponse<T> {
    content: T[];
    size: number;
    number: number; // 0-indexed (Spring Boot 3)
    totalElements: number;
    totalPages: number;
}
