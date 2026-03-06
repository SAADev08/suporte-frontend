import api from "./axios.config";
import type { Cliente } from "../../types";

export interface ClienteRequest {
    nome: string;
    cidade: string;
    cpfCnpj: string;
    contatoPrincipal?: string;
    comercialResponsavel?: string;
}

export const clienteApi = {
    listar: (params?: { nome?: string; cidade?: string; cpfCnpj?: string }) =>
        api.get<Cliente[]>("/api/clientes", { params }),

    buscarPorId: (id: string) => api.get<Cliente>(`/api/clientes/${id}`),

    criar: (data: ClienteRequest) => api.post<Cliente>("/api/clientes", data),

    atualizar: (id: string, data: ClienteRequest) =>
        api.put<Cliente>(`/api/clientes/${id}`, data),

    inativar: (id: string) => api.patch(`/api/clientes/${id}/inativar`),
};
