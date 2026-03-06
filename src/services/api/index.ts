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
};

// ─── Chamados ─────────────────────────────────────────────────────────────────
export const chamadoApi = {
    listar: (page = 0, size = 10) =>
        api.get<PageResponse<Chamado>>("/api/chamados", {
            params: { page, size },
        }),
    buscarPorId: (id: string) => api.get<Chamado>(`/api/chamados/${id}`),
    criar: (data: Partial<Chamado>) => api.post<Chamado>("/api/chamados", data),
    atualizar: (id: string, data: Partial<Chamado>) =>
        api.put<Chamado>(`/api/chamados/${id}`, data),
    encerrar: (id: string, solucao: string) =>
        api.patch(`/api/chamados/${id}/encerrar`, { solucao }),
};

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const chatApi = {
    listarPorChamado: (chamadoId: string) =>
        api.get<Chat[]>(`/api/chat/chamado/${chamadoId}`),
    listarSemChamado: () => api.get<Chat[]>("/api/chat/sem-chamado"),
    enviarMensagem: (data: Partial<Chat>) => api.post<Chat>("/api/chat", data),
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
