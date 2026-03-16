import api from "./axios.config";
import type { Contato, PageResponse } from "../../types";

export interface ContatoRequest {
    nome: string;
    telefone: string;
    email?: string;
    clienteIds: string[];
}

export interface ContatoFiltros {
    nome?: string;
    telefone?: string;
    email?: string;
    page?: number;
    size?: number;
}

export const contactApi = {
    listar: (params: ContatoFiltros = {}) =>
        api.get<PageResponse<Contato>>("/api/contatos", {
            params: { page: 0, size: 10, ...params },
        }),

    buscarPorId: (id: string) => api.get<Contato>(`/api/contatos/${id}`),

    criar: (data: ContatoRequest) => api.post<Contato>("/api/contatos", data),

    atualizar: (id: string, data: ContatoRequest) =>
        api.put<Contato>(`/api/contatos/${id}`, data),

    inativar: (id: string) => api.patch(`/api/contatos/${id}/inativar`),
};
