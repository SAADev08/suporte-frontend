// ─── Auth ─────────────────────────────────────────────────────────────────────
export type Perfil = "ANALISTA" | "GESTOR";

export interface Usuario {
    id: string;
    nome: string;
    email: string;
    perfil: Perfil;
    ativo: boolean;
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
    clientes?: Cliente[];
}

// ─── Chamado ──────────────────────────────────────────────────────────────────
export type ChamadoStatus =
    | "AGUARDANDO"
    | "EM_ATENDIMENTO"
    | "AGUARDANDO_CLIENTE"
    | "ENCERRADO";
export type Categoria = "ERRO" | "DUVIDA";
export type Origem = "WHATSAPP" | "EMAIL" | "TELEFONE";
export type NivelSla = "NORMAL" | "ALERTA" | "CRITICO" | "ESCALADO";

export interface Chamado {
    id: string;
    texto: string;
    categoria: Categoria;
    statusAtual: ChamadoStatus;
    origem: Origem;
    nivelSla: NivelSla;
    dtAbertura: string;
    dtPrimeiraMensagem?: string;
    dtPrimeiraResposta?: string;
    dtEncerramento?: string;
    solucao?: string;
    contato: Contato;
    usuarioResponsavel?: Usuario;
    subtipo?: Subtipo;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export type TipoMidia = "TEXTO" | "IMAGEM" | "AUDIO" | "VIDEO";
export type ChatOrigem = "CLIENTE" | "SUPORTE";

export interface Chat {
    id: string;
    idChamado?: string;
    idContato: string;
    origem: ChatOrigem;
    dtEnvio: string;
    texto?: string;
    fileUrl?: string;
    tipoMidia: TipoMidia;
    foneCliente: string;
    nomeContato: string;
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

// ─── API ──────────────────────────────────────────────────────────────────────
export interface PageResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
}
