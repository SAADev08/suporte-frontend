import { useEffect } from "react";
import { wsService } from "../services/websocket";
import { useNotificacaoStore } from "../store/notificationStore";
import { useAuthStore } from "../store/authStore";

export function useWebSocket() {
    const { token, isAuthenticated } = useAuthStore();
    const { adicionar } = useNotificacaoStore();

    useEffect(() => {
        if (!isAuthenticated || !token) return;

        if (!wsService.isConnected()) {
            wsService.connect(token);
        }

        wsService.subscribe("/topic/notificacoes", (body: unknown) => {
            const data = body as { mensagem?: string; nivel?: string };
            adicionar({
                tipo: (data.nivel?.toLowerCase() as "alerta") || "info",
                mensagem: data.mensagem || "Nova notificação recebida",
            });
        });

        wsService.subscribe("/topic/sla", (body: unknown) => {
            const data = body as { mensagem?: string; nivel?: string };
            adicionar({
                tipo:
                    data.nivel === "CRITICO"
                        ? "critico"
                        : data.nivel === "ESCALADO"
                          ? "escalado"
                          : "alerta",
                mensagem: data.mensagem || "Alerta de SLA",
            });
        });
    }, [isAuthenticated, token]);
}
