import api from "./axios.config";
import type { Cliente, PageResponse } from "../../types";

export interface ClienteRequest {
    nome: string;
    cidade: string;
    cpfCnpj: string;
    contatoPrincipal?: string;
    comercialResponsavel?: string;
}

export interface ClienteFiltros {
    nome?: string;
    cidade?: string;
    cpfCnpj?: string;
    page?: number;
    size?: number;
}

export const clienteApi = {
    listar: (params: ClienteFiltros = {}) =>
        api.get<PageResponse<Cliente>>("/api/clientes", {
            params: { page: 0, size: 10, ...params },
        }),
    buscarPorId: (id: string) => api.get<Cliente>(`/api/clientes/${id}`),

    criar: (data: ClienteRequest) => api.post<Cliente>("/api/clientes", data),

    atualizar: (id: string, data: ClienteRequest) =>
        api.put<Cliente>(`/api/clientes/${id}`, data),

    inativar: (id: string) => api.patch(`/api/clientes/${id}/inativar`),
};
