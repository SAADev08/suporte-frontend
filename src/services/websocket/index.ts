import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const WS_URL = import.meta.env.VITE_WS_URL;

type MessageCallback = (body: unknown) => void;

class WebSocketService {
    private client: Client | null = null;
    private subscriptions: Map<string, MessageCallback[]> = new Map();

    connect(token: string, onConnected?: () => void) {
        this.client = new Client({
            webSocketFactory: () => new SockJS(WS_URL) as WebSocket,
            connectHeaders: { Authorization: `Bearer ${token}` },
            reconnectDelay: 5000,
            onConnect: () => {
                console.log("[WS] Conectado");
                this.resubscribeAll();
                onConnected?.();
            },
            onDisconnect: () => console.log("[WS] Desconectado"),
            onStompError: frame => {
                console.error("[WS] Erro:", frame);
                if (
                    frame.headers?.message?.includes("JWT") ||
                    frame.headers?.message?.includes("autenticação")
                ) {
                    // ex: router.push('/login') ou dispatch(logout())
                }
            },
        });
        this.client.activate();
    }

    disconnect() {
        this.client?.deactivate();
        this.client = null;
        this.subscriptions.clear();
    }

    subscribe(topic: string, callback: MessageCallback) {
        if (!this.subscriptions.has(topic)) {
            this.subscriptions.set(topic, []);
        }
        this.subscriptions.get(topic)!.push(callback);

        if (this.client?.connected) {
            this.client.subscribe(topic, msg => {
                try {
                    const body = JSON.parse(msg.body);
                    this.subscriptions.get(topic)?.forEach(cb => cb(body));
                } catch {
                    this.subscriptions.get(topic)?.forEach(cb => cb(msg.body));
                }
            });
        }
    }

    private resubscribeAll() {
        this.subscriptions.forEach((callbacks, topic) => {
            this.client?.subscribe(topic, msg => {
                try {
                    const body = JSON.parse(msg.body);
                    callbacks.forEach(cb => cb(body));
                } catch {
                    callbacks.forEach(cb => cb(msg.body));
                }
            });
        });
    }

    isConnected() {
        return this.client?.connected ?? false;
    }
}

export const wsService = new WebSocketService();
