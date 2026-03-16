import api from "./axios.config";
import type { Tipo, Subtipo } from "../../types";

export interface TipoRequest {
    nome: string;
}

export interface SubtipoRequest {
    nome: string;
}

export const typeApi = {
    listar: () => api.get<Tipo[]>("/api/tipos"),

    criar: (data: TipoRequest) => api.post<Tipo>("/api/tipos", data),

    listarSubtipos: (tipoId: string) =>
        api.get<Subtipo[]>(`/api/tipos/${tipoId}/subtipos`),

    criarSubtipo: (tipoId: string, data: SubtipoRequest) =>
        api.post<Subtipo>(`/api/tipos/${tipoId}/subtipos`, data),
};
