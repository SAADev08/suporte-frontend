import api from "./axios.config";
import type {
    PageResponse,
    Chat,
    FilaAgrupadaItem,
    TipoMidia,
    Categoria,
    Chamado,
} from "../../types";

export interface ChatEnviarRequest {
    chamadoId: string;
    texto?: string;
    fileUrl?: string;
    tipoMidia?: TipoMidia;
}

// ─── Resposta na triagem (sem chamado) ───────────────────────────────────────
export interface RespostaTriagemRequest {
    contatoId: string;
    texto?: string;
    fileUrl?: string;
    tipoMidia?: TipoMidia;
}

// ─── Nova conversa ativa (outbound) ──────────────────────────────────────────
export interface IniciarChatRequest {
    contatoId: string;
    texto?: string;
    fileUrl?: string;
    tipoMidia?: TipoMidia;
    descricaoChamado?: string;
    categoria?: Categoria;
}

export interface IniciarChatResponse {
    chamado: Chamado;
    mensagem: Chat;
}

export const chatApi = {
    buscarPorChamado: (chamadoId: string, page = 0, size = 30) =>
        api.get<PageResponse<Chat>>(`/api/chat/chamado/${chamadoId}`, {
            params: { page, size, sort: "dtEnvio,asc" },
        }),

    filaAgrupada: (page = 0, size = 20) =>
        api.get<PageResponse<FilaAgrupadaItem>>("/api/chat/fila/agrupada", {
            params: { page, size },
        }),

    fila: (page = 0, size = 30) =>
        api.get<PageResponse<Chat>>("/api/chat/fila", {
            params: { page, size },
        }),

    /** Busca todas as mensagens de um contato na triagem (sem chamado). */
    conversaTriagem: (contatoId: string) =>
        api.get<Chat[]>(`/api/chat/triagem/${contatoId}`),

    /** Responde a um contato na triagem sem abrir chamado formal. */
    responderTriagem: (data: RespostaTriagemRequest) =>
        api.post<Chat>("/api/chat/responder-triagem", data),

    enviar: (data: ChatEnviarRequest) =>
        api.post<Chat>("/api/chat/responder", data),

    iniciarChat: (data: IniciarChatRequest) =>
        api.post<IniciarChatResponse>("/api/chat/iniciar", data),

    /** Timeline unificada por contato — todas as mensagens em ordem cronológica. */
    buscarPorContato: (contatoId: string, page = 0, size = 50) =>
        api.get<PageResponse<Chat>>(`/api/chat/contato/${contatoId}`, {
            params: { page, size },
        }),
};
