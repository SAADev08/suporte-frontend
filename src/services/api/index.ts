import api from "./axios.config";
import type {
    LoginResponse,
    Contato,
    Chamado,
    Chat,
    Tipo,
    Subtipo,
    Usuario,
    PageResponse,
    ContatoPendente,
    FilaAgrupadaItem,
} from "../../types";

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
    login: (email: string, senha: string) =>
        api.post<LoginResponse>("/api/auth/login", { email, senha }),
};

// ─── Contatos ─────────────────────────────────────────────────────────────────
export const contatoApi = {
    listar: (page = 0, size = 10, nome?: string) =>
        api.get<PageResponse<Contato>>("/api/contatos", {
            params: { page, size, nome },
        }),
    buscarPorId: (id: string) => api.get<Contato>(`/api/contatos/${id}`),
    criar: (data: Partial<Contato>) => api.post<Contato>("/api/contatos", data),
    atualizar: (id: string, data: Partial<Contato>) =>
        api.put<Contato>(`/api/contatos/${id}`, data),
    inativar: (id: string) => api.delete(`/api/contatos/${id}`),
    pendentes: (page = 0, size = 20) =>
        api.get<PageResponse<ContatoPendente>>("/api/contatos/pendentes", {
            params: { page, size },
        }),
};

// ─── Chamados ─────────────────────────────────────────────────────────────────
export interface ChamadoFiltros {
    status?: string;
    origem?: string;
    contatoId?: string;
    usuarioId?: string;
    page?: number;
    size?: number;
}
export const chamadoApi = {
    listar: (filtros: ChamadoFiltros = {}) =>
        api.get<PageResponse<Chamado>>("/api/chamados", {
            params: { page: 0, size: 50, ...filtros },
        }),
    buscarPorId: (id: string) => api.get<Chamado>(`/api/chamados/${id}`),
    criar: (data: Partial<Chamado>) => api.post<Chamado>("/api/chamados", data),
    atualizar: (id: string, data: Partial<Chamado>) =>
        api.put<Chamado>(`/api/chamados/${id}`, data),
    encerrar: (id: string, solucao: string) =>
        api.patch(`/api/chamados/${id}/encerrar`, { solucao }),
};

// ─── Chat ─────────────────────────────────────────────────────────────────────
export interface ChatEnviarRequest {
    chamadoId: string;
    texto?: string;
    fileUrl?: string;
    tipoMidia?: "TEXTO" | "IMAGEM" | "AUDIO" | "VIDEO";
}

export const chatApi = {
    /**
     * Mensagens de um chamado específico, ordenadas por data de envio.
     * GET /api/chat/chamado/:chamadoId
     */
    buscarPorChamado: (chamadoId: string, page = 0, size = 30) =>
        api.get<PageResponse<Chat>>(`/api/chat/chamado/${chamadoId}`, {
            params: { page, size, sort: "dtEnvio,asc" },
        }),

    /**
     * Fila de triagem agrupada por contato — endpoint principal da aba Triagem.
     * GET /api/chat/fila/agrupada
     */
    filaAgrupada: (page = 0, size = 20) =>
        api.get<PageResponse<FilaAgrupadaItem>>("/api/chat/fila/agrupada", {
            params: { page, size },
        }),

    /**
     * Fila plana — todas as mensagens sem chamado.
     * GET /api/chat/fila
     */
    fila: (page = 0, size = 30) =>
        api.get<PageResponse<Chat>>("/api/chat/fila", {
            params: { page, size, sort: "dtEnvio,asc" },
        }),

    /**
     * Envia resposta do analista para um chamado.
     * POST /api/chat/responder
     */
    enviar: (data: ChatEnviarRequest) =>
        api.post<Chat>("/api/chat/responder", data),
};

// ─── Usuários ─────────────────────────────────────────────────────────────────
export const usuarioApi = {
    listar: (page = 0, size = 10) =>
        api.get<PageResponse<Usuario>>("/api/usuarios", {
            params: { page, size },
        }),
    buscarPorId: (id: string) => api.get<Usuario>(`/api/usuarios/${id}`),
    criar: (data: Partial<Usuario> & { senha: string }) =>
        api.post<Usuario>("/api/usuarios", data),
    atualizar: (id: string, data: Partial<Usuario>) =>
        api.put<Usuario>(`/api/usuarios/${id}`, data),
    inativar: (id: string) => api.delete(`/api/usuarios/${id}`),
};

// ─── Tipos / Subtipos ─────────────────────────────────────────────────────────
export const tipoApi = {
    listar: () => api.get<Tipo[]>("/api/tipos"),
    criar: (data: Partial<Tipo>) => api.post<Tipo>("/api/tipos", data),
    atualizar: (id: string, data: Partial<Tipo>) =>
        api.put<Tipo>(`/api/tipos/${id}`, data),
    criarSubtipo: (tipoId: string, data: Partial<Subtipo>) =>
        api.post<Subtipo>(`/api/tipos/${tipoId}/subtipos`, data),
};
