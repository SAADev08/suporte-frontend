import api from "./axios.config";
import type { PageResponse, Chat, FilaAgrupadaItem } from "../../types";

export interface ChatEnviarRequest {
    chamadoId: string;
    texto?: string;
    fileUrl?: string;
    tipoMidia?: "TEXTO" | "IMAGEM" | "AUDIO" | "VIDEO";
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

    enviar: (data: ChatEnviarRequest) =>
        api.post<Chat>("/api/chat/responder", data),
};
