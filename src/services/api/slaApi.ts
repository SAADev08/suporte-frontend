import type { NotificacaoSla, NotificacaoTriagemSla } from "../../types";
import api from "./axios.config";

export const slaApi = {
    ativos: () => api.get<NotificacaoSla[]>("/api/sla/ativos"),
    triagemAtivos: () => api.get<NotificacaoTriagemSla[]>("/api/sla/triagem/ativos"),
};
