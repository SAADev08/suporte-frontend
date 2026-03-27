import { Client, type StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const WS_URL = import.meta.env.VITE_WS_URL;

type MessageCallback = (body: unknown) => void;

const MAX_PROCESSED_EVENTS = 500;

class WebSocketService {
    private client: Client | null = null;
    private subscriptions: Map<string, MessageCallback[]> = new Map();

    private stompHandles: Map<string, StompSubscription> = new Map();

    // Callback para recarregar estado após reconexão (injetado pelo useWebSocket)
    private onReconnectCallback: (() => void) | null = null;

    // Callback de erro de auth (token expirado)
    private onAuthErrorCallback: (() => void) | null = null;

    public onReconnect: (() => void) | null = null;
    public onDisconnected: (() => void) | null = null;

    // Getter público para o estado de conexão
    isConnected(): boolean {
        return this.client?.connected ?? false;
    }

    connect(
        getToken: () => string | null,
        onConnected?: () => void,
        onAuthError?: () => void,
    ) {
        this.onReconnectCallback = onConnected ?? null;
        this.onAuthErrorCallback = onAuthError ?? null;

        if (this.client?.connected) {
            onConnected?.();
            return;
        }

        // Se já existe um client ativo (reconectando), não recria
        if (this.client) {
            return;
        }

        this.client = new Client({
            webSocketFactory: () => new SockJS(WS_URL) as WebSocket,
            connectHeaders: {
                // Avaliado no momento da conexão, não do construtor
                get Authorization() {
                    return `Bearer ${getToken()}`;
                },
            },
            reconnectDelay: 5000,

            heartbeatIncoming: 10_000,
            heartbeatOutgoing: 10_000,

            onConnect: () => {
                console.log("[WS] Conectado");

                this.clearStompHandles();
                this.resubscribeAll();
                this.onReconnectCallback?.();
                this.onReconnect?.();
            },
            onDisconnect: () => {
                console.log("[WS] Desconectado");
                this.clearStompHandles();
                this.onDisconnected?.();
            },
            onStompError: frame => {
                console.error("[WS] Erro:", frame);
                const isAuthError =
                    frame.headers?.message?.includes("JWT") ||
                    frame.headers?.message?.includes("autenticação") ||
                    frame.headers?.message?.includes("expired") ||
                    frame.headers?.message?.includes("Unauthorized");
                if (isAuthError) {
                    // ex: router.push('/login') ou dispatch(logout())
                    console.warn("[WS] Token inválido ou expirado.");
                    this.disconnect();
                    this.onAuthErrorCallback?.();
                }
            },
        });
        this.client.activate();
        this.registerBrowserEvents(getToken);
    }

    disconnect() {
        this.removeBrowserEvents();
        this.clearStompHandles();
        this.client?.deactivate();
        this.client = null;
        this.subscriptions.clear();
    }

    subscribe(topic: string, callback: MessageCallback): () => void {
        if (!this.subscriptions.has(topic)) {
            this.subscriptions.set(topic, []);
        }
        this.subscriptions.get(topic)!.push(callback);

        if (this.client?.connected && !this.stompHandles.has(topic)) {
            this.createStompSubscription(topic);
        }

        return () => this.unsubscribe(topic, callback);
    }

    unsubscribe(topic: string, callback: MessageCallback): void {
        const callbacks = this.subscriptions.get(topic);
        if (!callbacks) return;

        const remaining = callbacks.filter(cb => cb !== callback);

        if (remaining.length === 0) {
            this.subscriptions.delete(topic);
            const handle = this.stompHandles.get(topic);
            if (handle) {
                try {
                    handle.unsubscribe();
                } catch (err) {
                    console.warn("[WS] Falha ao cancelar assinatura STOMP:", err);
                }
                this.stompHandles.delete(topic);
            }
        } else {
            this.subscriptions.set(topic, remaining);
        }
    }

    private resubscribeAll() {
        this.subscriptions.forEach((_callbacks, topic) => {
            this.createStompSubscription(topic);
        });
    }

    private clearStompHandles() {
        this.stompHandles.forEach(handle => {
            try {
                handle.unsubscribe();
            } catch (err) {
                console.warn("[WS] Falha ao limpar handle STOMP:", err);
            }
        });
        this.stompHandles.clear();
    }

    private createStompSubscription(topic: string) {
        if (!this.client?.connected) return;
        if (this.stompHandles.has(topic)) return;

        const handle = this.client.subscribe(topic, msg => {
            const callbacks = this.subscriptions.get(topic);
            if (!callbacks?.length) return;

            try {
                const body = JSON.parse(msg.body);
                callbacks.forEach(cb => cb(body));
            } catch {
                callbacks.forEach(cb => cb(msg.body));
            }
        });

        this.stompHandles.set(topic, handle);
    }

    // ─── Eventos do browser ──────────────────────────────────────────────────

    private visibilityHandler: (() => void) | null = null;
    private onlineHandler: (() => void) | null = null;

    private registerBrowserEvents(getToken: () => string | null) {
        // Ao voltar ao foco (aba que estava em background), força reconexão
        this.visibilityHandler = () => {
            if (
                document.visibilityState === "visible" &&
                !this.client?.connected
            ) {
                console.log("[WS] Aba voltou ao foco — reconectando...");
                this.reconnectWith(getToken);
            }
        };

        // Ao recuperar conectividade de rede
        this.onlineHandler = () => {
            if (!this.client?.connected) {
                console.log("[WS] Rede restaurada — reconectando...");
                this.reconnectWith(getToken);
            }
        };

        document.addEventListener("visibilitychange", this.visibilityHandler);
        window.addEventListener("online", this.onlineHandler);
    }

    private removeBrowserEvents() {
        if (this.visibilityHandler) {
            document.removeEventListener(
                "visibilitychange",
                this.visibilityHandler,
            );
            this.visibilityHandler = null;
        }
        if (this.onlineHandler) {
            window.removeEventListener("online", this.onlineHandler);
            this.onlineHandler = null;
        }
    }

    /**
     * Reativa o client caso ele tenha sido desativado por inatividade
     * ou por uma desconexão forçada (ex: backend reiniciado enquanto
     * a aba estava em background e o heartbeat expirou).
     */
    private reconnectWith(getToken: () => string | null) {
        if (this.client?.connected) return;

        if (this.client) {
            // Já existe um client mas está desconectado — reativa
            this.client.connectHeaders = {
                Authorization: `Bearer ${getToken()}`,
            };
            this.client.activate();
        }
        // Se não existe client, connect() será chamado pelo hook normalmente
    }
}

export const wsService = new WebSocketService();

// ─── Cache de deduplicação (compartilhado) ───────────────────────────────────

export class BoundedEventCache {
    private set = new Set<string>();
    private queue: string[] = []; // mantém ordem de inserção
    private max: number;

    constructor(max = MAX_PROCESSED_EVENTS) {
        this.max = max;
    }

    /** Retorna true se o eventId já foi processado (ou se não há id). */
    has(eventId?: string): boolean {
        if (!eventId) return false;
        return this.set.has(eventId);
    }

    /** Registra o eventId. Retorna true se era duplicata (já existia). */
    markAndCheck(eventId?: string): boolean {
        if (!eventId) return false;
        if (this.set.has(eventId)) return true;

        this.set.add(eventId);
        this.queue.push(eventId);

        // Remove o mais antigo quando ultrapassa o limite
        if (this.queue.length > this.max) {
            const oldest = this.queue.shift()!;
            this.set.delete(oldest);
        }

        return false;
    }

    clear() {
        this.set.clear();
        this.queue = [];
    }
}
