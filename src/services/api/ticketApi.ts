import api from "./axios.config";
import type {
    Chamado,
    ChamadoStatusHistorico,
    Categoria,
    Origem,
    ChamadoStatus,
    PageResponse,
} from "../../types";

export type {
    ChamadoStatus as ChamadoStatusType,
    Categoria as CategoriaType,
    Origem as OrigemType,
};

export interface ChamadoRequest {
    texto?: string;
    categoria?: Categoria;
    solucao?: string;
    statusAtual?: ChamadoStatus;
    origem: Origem;
    contatoId: string;
    usuarioResponsavelId?: string;
    subtipoId?: string;
    /**
     * IDs das mensagens da triagem a serem vinculadas ao chamado no momento
     * da criação. Quando informado, o backend associa cada chat ao chamado
     * recém-criado (id_chamado preenchido), removendo-as da fila de triagem.
     */
    chatIds?: string[];
}

export interface EncerrarRequest {
    solucao: string;
}

export const ticketApi = {
    listar: (params?: {
        status?: ChamadoStatus;
        origem?: Origem;
        contatoId?: string;
        usuarioId?: string;
        page?: number;
        size?: number;
    }) =>
        api.get<PageResponse<Chamado>>("/api/chamados", {
            params: { page: 0, size: 10, ...params },
        }),

    buscarPorId: (id: string) => api.get<Chamado>(`/api/chamados/${id}`),

    criar: (data: ChamadoRequest) => api.post<Chamado>("/api/chamados", data),

    atualizar: (id: string, data: ChamadoRequest) =>
        api.put<Chamado>(`/api/chamados/${id}`, data),

    encerrar: (id: string, data: EncerrarRequest) =>
        api.patch<Chamado>(`/api/chamados/${id}/encerrar`, data),

    historico: (id: string) =>
        api.get<ChamadoStatusHistorico[]>(`/api/chamados/${id}/historico`),
};
