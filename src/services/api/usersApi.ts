import api from "./axios.config";
import type { PageResponse, Usuario } from "../../types";

export type PerfilType = "ANALISTA" | "GESTOR";

export interface UserRequest {
    nome: string;
    email: string;
    senha?: string;
    perfil: PerfilType;
}

export interface UsuarioFiltros {
    nome?: string;
    email?: string;
    perfil?: PerfilType;
    page?: number;
    size?: number;
}

export const userApi = {
    listar: (params: UsuarioFiltros = {}) =>
        api.get<PageResponse<Usuario>>("/api/usuarios", {
            params: { page: 0, size: 10, ...params },
        }),

    buscarPorId: (id: string) => api.get<Usuario>(`/api/usuarios/${id}`),

    criar: (data: UserRequest) => api.post<Usuario>("/api/usuarios", data),

    atualizar: (id: string, data: UserRequest) =>
        api.put<Usuario>(`/api/usuarios/${id}`, data),

    inativar: (id: string) => api.patch(`/api/usuarios/${id}/inativar`),

    reativar: (id: string) => api.patch(`/api/usuarios/${id}/reativar`),
};
