import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import type { Chat, WsEnvelope } from "../../types";
import {
    chatApi,
    type RespostaTriagemRequest,
} from "../../services/api/chatApi";
import { wsService, BoundedEventCache } from "../../services/websocket";
import { CATEGORIA_CONFIG, formatarDataHora } from "../../utils/ticketsHelpers";
import { buildTimeline } from "../../utils/buildTimeline";
import { usePaginatedMessages } from "../../hooks/usePaginatedMessages";
import { useNavigationStore } from "../../store/navigationStore";
import { formatDataCurta, formatHora } from "../../utils/formatters";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ContatoTriagemAtivo {
    contatoId: string;
    nomeContato: string;
    foneContato: string;
    pendenteVinculacao: boolean;
}

interface Props {
    contatoTriagemAtivo: ContatoTriagemAtivo;
    onFechar: () => void;
    onCriarChamado: (contatoId: string) => void;
    /** Chamado ao confirmar envio de resposta — permite limpar alertas de SLA no pai */
    onResponder?: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function TriagemConversaPanel({
    contatoTriagemAtivo,
    onFechar,
    onCriarChamado,
    onResponder,
}: Props) {
    const { navigate } = useNavigationStore();

    const [texto, setTexto] = useState("");
    const [enviando, setEnviando] = useState(false);

    const paginado = usePaginatedMessages();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fimRef = useRef<HTMLDivElement>(null);
    const processedEvents = useRef(new BoundedEventCache());

    const { contatoId } = contatoTriagemAtivo;

    // ── Carga inicial ─────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        paginado.initialize(contatoId).catch(() => {
            if (!cancelled) toast.error("Erro ao carregar conversa");
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contatoId]);

    // ── Scroll automático ao receber nova mensagem ────────────────────────────
    useEffect(() => {
        if (paginado.isLoadingOlderRef.current) return;
        fimRef.current?.scrollIntoView({ behavior: "smooth" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paginado.messages.length]);

    // ── WebSocket: mensagens em tempo real ────────────────────────────────────
    useEffect(() => {
        const cleanup = wsService.subscribe(
            `/topic/contato/${contatoId}`,
            (body: unknown) => {
                const env = body as WsEnvelope<Chat>;
                if (processedEvents.current.markAndCheck(env.eventId)) return;
                const msg = env.payload;
                paginado.setMessages(prev =>
                    prev.some(m => m.id === msg.id) ? prev : [...prev, msg],
                );
            },
        );
        return cleanup;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contatoId]);

    // ── Envio de mensagem ─────────────────────────────────────────────────────
    const enviar = async () => {
        if (!texto.trim() || enviando) return;
        const textoEnvio = texto.trim();
        setTexto("");
        setEnviando(true);
        try {
            const req: RespostaTriagemRequest = {
                contatoId,
                texto: textoEnvio,
                tipoMidia: "TEXTO",
            };
            const { data } = await chatApi.responderTriagem(req);
            paginado.setMessages(prev => [...prev, data]);
            onResponder?.();
        } catch {
            toast.error("Erro ao enviar mensagem");
            setTexto(textoEnvio);
        } finally {
            setEnviando(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            enviar();
        }
    };

    const timeline = buildTimeline(paginado.messages, paginado.chamados);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            <div className="chat-header-conversa">
                <div className="chat-header-avatar chat-header-avatar-triagem">
                    {contatoTriagemAtivo.nomeContato.charAt(0).toUpperCase()}
                </div>
                <div className="chat-header-info">
                    <strong>{contatoTriagemAtivo.nomeContato}</strong>
                    <span className="chat-header-status chat-triagem-badge">
                        📥 Triagem · {contatoTriagemAtivo.foneContato}
                    </span>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button
                        type="button"
                        className="btn-primary btn-sm"
                        onClick={() => onCriarChamado(contatoId)}
                        disabled={contatoTriagemAtivo.pendenteVinculacao}
                        title={
                            contatoTriagemAtivo.pendenteVinculacao
                                ? "Vincule o contato a um Cliente primeiro"
                                : "Criar chamado formal"
                        }
                    >
                        + Criar Chamado
                    </button>
                    <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={onFechar}
                    >
                        ✕ Fechar
                    </button>
                </div>
            </div>

            {contatoTriagemAtivo.pendenteVinculacao && (
                <div className="chat-triagem-aviso-vinculacao">
                    🔗 Este contato ainda não está vinculado a um Cliente. Você
                    pode responder, mas não é possível criar um chamado até
                    realizar a vinculação.
                    <button
                        type="button"
                        className="btn-link"
                        style={{ marginLeft: 8 }}
                        onClick={() => navigate("contatos")}
                    >
                        Vincular agora
                    </button>
                </div>
            )}

            <div className="chat-mensagens" ref={paginado.containerRef}>
                {paginado.loading ? (
                    <div className="chat-msgs-loading">
                        Carregando mensagens...
                    </div>
                ) : timeline.length === 0 ? (
                    <div className="chat-msgs-vazio">
                        <p>Nenhuma mensagem ainda</p>
                    </div>
                ) : (
                    <>
                        {paginado.hasOlderPages && (
                            <div className="chat-timeline-load-older">
                                <button
                                    type="button"
                                    onClick={paginado.loadOlderMessages}
                                    disabled={paginado.loadingOlder}
                                >
                                    {paginado.loadingOlder
                                        ? "Carregando..."
                                        : "↑ Carregar mensagens anteriores"}
                                </button>
                            </div>
                        )}
                        {timeline.map((item, i) => {
                            if (item.kind === "open") {
                                const cat = item.data.categoria
                                    ? CATEGORIA_CONFIG[item.data.categoria]
                                    : null;
                                return (
                                    <div
                                        key={`open-${item.data.id}`}
                                        className="chat-timeline-marker chat-timeline-marker-open"
                                    >
                                        <div className="chat-timeline-marker-content">
                                            <span>
                                                📋 Chamado aberto
                                                {cat
                                                    ? ` — ${cat.icone} ${cat.label}`
                                                    : ""}
                                            </span>
                                            <span className="chat-timeline-marker-ts">
                                                {formatarDataHora(
                                                    item.data.dtAbertura,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }
                            if (item.kind === "close") {
                                return (
                                    <div
                                        key={`close-${item.data.id}`}
                                        className="chat-timeline-marker chat-timeline-marker-close"
                                    >
                                        <div className="chat-timeline-marker-content">
                                            <span>🔒 Chamado encerrado</span>
                                            <span className="chat-timeline-marker-ts">
                                                {formatarDataHora(
                                                    item.data.dtEncerramento,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }
                            const msg = item.data;
                            const prevItem = timeline[i - 1];
                            const mesmoDia =
                                prevItem &&
                                new Date(prevItem.ts).toDateString() ===
                                    new Date(item.ts).toDateString();
                            const isSuporte = msg.origem === "SUPORTE";
                            return (
                                <div key={msg.id}>
                                    {!mesmoDia && (
                                        <div className="chat-separador-data">
                                            <span>
                                                {formatDataCurta(item.ts)}
                                            </span>
                                        </div>
                                    )}
                                    <div
                                        className={`chat-msg ${isSuporte ? "chat-msg-suporte" : "chat-msg-cliente"}`}
                                    >
                                        {!isSuporte && (
                                            <div className="chat-msg-avatar">
                                                {(msg.nomeContato || "?")
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>
                                        )}
                                        <div className="chat-msg-balao">
                                            {!isSuporte && (
                                                <span className="chat-msg-remetente">
                                                    {msg.nomeContato}
                                                </span>
                                            )}
                                            {msg.tipoMidia === "IMAGEM" &&
                                            msg.fileUrl ? (
                                                <img
                                                    src={msg.fileUrl}
                                                    alt="imagem"
                                                    className="chat-msg-imagem"
                                                />
                                            ) : msg.tipoMidia === "AUDIO" &&
                                              msg.fileUrl ? (
                                                <audio
                                                    controls
                                                    src={msg.fileUrl}
                                                    className="chat-msg-audio"
                                                />
                                            ) : (
                                                <p className="chat-msg-texto">
                                                    {msg.texto}
                                                </p>
                                            )}
                                            <span className="chat-msg-hora">
                                                {formatHora(msg.dtEnvio)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={fimRef} />
                    </>
                )}
            </div>

            <div className="chat-input-area">
                <textarea
                    ref={inputRef}
                    className="chat-input"
                    placeholder="Responder sem abrir chamado… (Enter para enviar, Shift+Enter para nova linha)"
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    disabled={enviando}
                />
                <button
                    type="button"
                    className="chat-btn-enviar"
                    onClick={enviar}
                    disabled={!texto.trim() || enviando}
                    title="Enviar (Enter)"
                >
                    {enviando ? "⏳" : "➤"}
                </button>
            </div>
        </>
    );
}
