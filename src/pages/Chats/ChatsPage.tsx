import { useState, useEffect, useCallback, useRef } from "react";
import "./chats.css";
import toast from "react-hot-toast";
import type {
    Chat,
    Chamado,
    NotificacaoSla,
    FilaAgrupadaItem,
} from "../../types";
import { chatApi } from "../../services/api/chatApi";
import { ticketApi, type ChamadoRequest } from "../../services/api/ticketApi";
// import { useAuthStore } from "../store/authStore";
import { STATUS_CONFIG, formatarDataHora } from "../../utils/ticketsHelpers";
import type { ChamadoStatus, NivelSla } from "../../types";
import { wsService } from "../../services/websocket";
import { useNavigationStore } from "../../store/navigationStore";
import { useNotificacaoStore } from "../../store/notificationStore";

// ─── Tipos locais ─────────────────────────────────────────────────────────────
type Aba = "atendimento" | "triagem";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatarHora(iso?: string | null): string {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatarDataCurta(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    if (d.toDateString() === hoje.toDateString()) return "Hoje";
    if (d.toDateString() === ontem.toDateString()) return "Ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Ícone e texto de fallback para mídias não-texto no preview da fila. */
function previewMidia(item: FilaAgrupadaItem): string {
    if (item.ultimoTexto) {
        return item.ultimoTexto.length > 45
            ? item.ultimoTexto.slice(0, 45) + "…"
            : item.ultimoTexto;
    }
    switch (item.ultimoTipoMidia) {
        case "IMAGEM":
            return "📷 Imagem";
        case "AUDIO":
            return "🎵 Áudio";
        case "VIDEO":
            return "🎬 Vídeo";
        default:
            return "—";
    }
}

const SLA_CONFIG: Record<
    NivelSla,
    { cor: string; bg: string; icone: string; label: string }
> = {
    ALERTA: {
        cor: "#92400e",
        bg: "rgba(251,191,36,.15)",
        icone: "⚠️",
        label: "Atenção",
    },
    CRITICO: {
        cor: "#c0392b",
        bg: "rgba(192,57,43,.1)",
        icone: "🔴",
        label: "Crítico",
    },
    ESCALADO: {
        cor: "#7c3aed",
        bg: "rgba(124,58,237,.1)",
        icone: "🚨",
        label: "Escalado",
    },
};

// ─── Componente principal ─────────────────────────────────────────────────────
export function ChatPage() {
    //   const { usuario } = useAuthStore()

    // ── Estado geral ─────────────────────────────────────────────────────────
    const [aba, setAba] = useState<Aba>("atendimento");
    const [chamados, setChamados] = useState<Chamado[]>([]);
    const [chamadoAtivo, setChamadoAtivo] = useState<Chamado | null>(null);
    const [mensagens, setMensagens] = useState<Chat[]>([]);
    const [loadingChamados, setLoadingChamados] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [texto, setTexto] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [alertasSla, setAlertasSla] = useState<NotificacaoSla[]>([]);

    // ── Triagem ───────────────────────────────────────────────────────────────
    const [filaAgrupada, setFilaAgrupada] = useState<FilaAgrupadaItem[]>([]);
    const [loadingTriagem, setLoadingTriagem] = useState(false);
    const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
    const [modalCriarChamado, setModalCriarChamado] = useState(false);
    const [formCriar, setFormCriar] = useState<Partial<ChamadoRequest>>({
        origem: "WHATSAPP",
        categoria: "DUVIDA",
    });
    const [criando, setCriando] = useState(false);

    // ── Contatos pendentes (do store global) ──────────────────────────────────
    const { contatosPendentes } = useNotificacaoStore();

    // ── Navegação (para redirecionar ao vincular contato) ─────────────────────
    const { navigate } = useNavigationStore();

    const fimMensagensRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // ─── WebSocket ────────────────────────────────────────────────────────────
    const handleNovaMensagem = useCallback(
        (msg: Chat) => {
            // Se chegou mensagem do chamado ativo → adiciona na conversa
            if (msg.chamadoId && msg.chamadoId === chamadoAtivo?.id) {
                setMensagens(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
            }
            // Se não tem chamado → vai para triagem
            if (!msg.chamadoId) {
                setFilaAgrupada(prev =>
                    prev.map(item =>
                        item.contatoId === msg.contatoId
                            ? {
                                  ...item,
                                  totalMensagens: item.totalMensagens + 1,
                                  dtUltimaMensagem:
                                      msg.dtEnvio ?? item.dtUltimaMensagem,
                                  ultimoTexto:
                                      msg.tipoMidia === "TEXTO"
                                          ? (msg.texto ?? item.ultimoTexto)
                                          : item.ultimoTexto,
                                  ultimoTipoMidia:
                                      msg.tipoMidia ?? item.ultimoTipoMidia,
                              }
                            : item,
                    ),
                );
            }
            // Atualiza preview na lista de chamados (última mensagem)
            if (msg.chamadoId) {
                setChamados(prev =>
                    prev.map(c =>
                        c.id === msg.chamadoId
                            ? ({ ...c, _ultimaMensagem: msg } as Chamado & {
                                  _ultimaMensagem: Chat;
                              })
                            : c,
                    ),
                );
            }
        },
        [chamadoAtivo?.id],
    );

    const handleNotificacaoSla = useCallback((notif: NotificacaoSla) => {
        setAlertasSla(prev => {
            // Substitui alerta existente do mesmo chamado
            const semExistente = prev.filter(
                a => a.chamadoId !== notif.chamadoId,
            );
            return [...semExistente, notif].slice(-5); // máximo 5 alertas visíveis
        });
        // Auto-remove após 30s
        setTimeout(() => {
            setAlertasSla(prev =>
                prev.filter(
                    a =>
                        a.chamadoId !== notif.chamadoId ||
                        a.timestamp !== notif.timestamp,
                ),
            );
        }, 30_000);
    }, []);

    useEffect(() => {
        wsService.subscribe("/topic/mensagens", (body: unknown) => {
            const msg = body as Chat;
            handleNovaMensagem(msg);
        });

        // SLA já é tratado pelo useWebSocket global (notificacaoStore)
        // mas se quiser refletir o alerta visual na lista de chamados:
        wsService.subscribe("/topic/notificacoes", (body: unknown) => {
            const data = body as {
                chamadoId?: string;
                nivel?: string;
                mensagem?: string;
                timestamp?: string;
            };
            if (data.chamadoId && data.nivel) {
                handleNotificacaoSla({
                    chamadoId: data.chamadoId,
                    nivel: data.nivel as NivelSla,
                    mensagem: data.mensagem || "",
                    timestamp: data.timestamp || new Date().toISOString(),
                });
            }
        });
    }, [handleNovaMensagem, handleNotificacaoSla]);

    // ─── Carregar chamados ────────────────────────────────────────────────────
    const carregarChamados = useCallback(async () => {
        setLoadingChamados(true);
        try {
            const [aguardando, emAtendimento, aguardandoCliente] =
                await Promise.all([
                    ticketApi.listar({ status: "AGUARDANDO" }),
                    ticketApi.listar({ status: "EM_ATENDIMENTO" }),
                    ticketApi.listar({ status: "AGUARDANDO_CLIENTE" }),
                ]);
            setChamados([
                ...aguardando.data.content,
                ...emAtendimento.data.content,
                ...aguardandoCliente.data.content,
            ]);
        } catch {
            toast.error("Erro ao carregar chamados");
        } finally {
            setLoadingChamados(false);
        }
    }, []);

    useEffect(() => {
        carregarChamados();
    }, [carregarChamados]);

    // ─── Selecionar chamado ───────────────────────────────────────────────────
    const selecionarChamado = useCallback(async (chamado: Chamado) => {
        setChamadoAtivo(chamado);
        setMensagens([]);
        setLoadingMsgs(true);
        try {
            const { data } = await chatApi.buscarPorChamado(chamado.id);
            setMensagens(data.content);
        } catch {
            toast.error("Erro ao carregar mensagens");
        } finally {
            setLoadingMsgs(false);
        }
    }, []);

    // Scroll automático ao final
    useEffect(() => {
        fimMensagensRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [mensagens]);

    // ─── Enviar mensagem ──────────────────────────────────────────────────────
    const enviarMensagem = async () => {
        if (!texto.trim() || !chamadoAtivo || enviando) return;
        const textoEnvio = texto.trim();
        setTexto("");
        setEnviando(true);
        try {
            const { data } = await chatApi.enviar({
                chamadoId: chamadoAtivo.id,
                texto: textoEnvio,
                tipoMidia: "TEXTO",
            });
            setMensagens(prev => [...prev, data]);
        } catch {
            toast.error("Erro ao enviar mensagem");
            setTexto(textoEnvio); // restaura texto se falhou
        } finally {
            setEnviando(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            enviarMensagem();
        }
    };

    // ─── Triagem ──────────────────────────────────────────────────────────────
    const carregarTriagem = useCallback(async () => {
        setLoadingTriagem(true);
        try {
            const { data } = await chatApi.filaAgrupada(0, 50);
            setFilaAgrupada(data.content);
        } catch {
            toast.error("Erro ao carregar triagem");
        } finally {
            setLoadingTriagem(false);
        }
    }, []);

    useEffect(() => {
        if (aba === "triagem") carregarTriagem();
    }, [aba, carregarTriagem]);

    const toggleSelecionado = (contatoId: string) => {
        setSelecionados(prev => {
            const next = new Set(prev);
            if (next.has(contatoId)) {
                next.delete(contatoId);
            } else {
                next.add(contatoId);
            }
            return next;
        });
    };

    const itensSelecionados = filaAgrupada.filter(g =>
        selecionados.has(g.contatoId),
    );

    const abrirModalCriar = () => {
        if (itensSelecionados.length === 0) return;

        // Bloqueia se qualquer contato selecionado ainda estiver pendente
        const comPendencia = itensSelecionados.filter(
            g => g.pendenteVinculacao,
        );
        if (comPendencia.length > 0) {
            toast.error(
                `${comPendencia.length} contato(s) precisam ser vinculados a um Cliente antes de criar o chamado.`,
            );
            return;
        }

        const primeiro = itensSelecionados[0];
        setFormCriar({
            origem: "WHATSAPP",
            categoria: "DUVIDA",
            contatoId: primeiro.contatoId,
            texto: "",
        });
        setModalCriarChamado(true);
    };

    const criarChamadoDeTriagem = async () => {
        if (!formCriar.contatoId) {
            toast.error("Contato é obrigatório");
            return;
        }
        setCriando(true);
        try {
            await ticketApi.criar(formCriar as ChamadoRequest);
            toast.success("Chamado criado com sucesso!");
            setModalCriarChamado(false);
            setSelecionados(new Set());
            carregarTriagem();
            carregarChamados();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message || "Erro ao criar chamado";
            toast.error(msg);
        } finally {
            setCriando(false);
        }
    };

    // ── Badge da aba Triagem ───────────────────────────────────────────────────
    // Conta contatos (grupos) — não mensagens individuais
    const totalTriagem = filaAgrupada.length;
    const totalPendentesVinculacao = contatosPendentes.length;

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="chat-page-wrapper">
            <div className="chat-shell">
                {/* ── Alertas SLA (sobrepostos no canto) ──────────────────────────── */}
                {alertasSla.length > 0 && (
                    <div className="sla-alertas">
                        {alertasSla.map((a, i) => {
                            const cfg = SLA_CONFIG[a.nivel];
                            return (
                                <div
                                    key={i}
                                    className="sla-alerta"
                                    style={{
                                        color: cfg.cor,
                                        background: cfg.bg,
                                        borderColor: cfg.cor + "40",
                                    }}
                                >
                                    <span>{cfg.icone}</span>
                                    <div>
                                        <strong>{cfg.label}</strong>
                                        <p>{a.mensagem}</p>
                                    </div>
                                    <button
                                        className="sla-alerta-fechar"
                                        onClick={() =>
                                            setAlertasSla(prev =>
                                                prev.filter(
                                                    (_, idx) => idx !== i,
                                                ),
                                            )
                                        }
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Coluna esquerda: abas + lista ────────────────────────────────── */}
                <div className="chat-sidebar">
                    <div className="chat-abas">
                        <button
                            className={`chat-aba ${aba === "atendimento" ? "ativa" : ""}`}
                            onClick={() => setAba("atendimento")}
                        >
                            🎧 Atendimento
                            {chamados.length > 0 && (
                                <span className="chat-aba-badge">
                                    {chamados.length}
                                </span>
                            )}
                        </button>
                        <button
                            className={`chat-aba ${aba === "triagem" ? "ativa" : ""}`}
                            onClick={() => setAba("triagem")}
                        >
                            📥 Triagem
                            {/* Badge principal: total de contatos aguardando */}
                            {totalTriagem > 0 && (
                                <span className="chat-aba-badge chat-aba-badge-alerta">
                                    {totalTriagem}
                                </span>
                            )}
                            {/* Badge secundário: contatos pendentes de vinculação */}
                            {totalPendentesVinculacao > 0 && (
                                <span
                                    className="chat-aba-badge"
                                    style={{
                                        background: "#f59e0b",
                                        marginLeft: 2,
                                    }}
                                    title={`${totalPendentesVinculacao} contato(s) aguardando vinculação com Cliente`}
                                >
                                    🔗 {totalPendentesVinculacao}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Lista de chamados (aba Atendimento) */}
                    {aba === "atendimento" && (
                        <div className="chat-lista">
                            {loadingChamados ? (
                                <div className="chat-lista-vazio">
                                    Carregando...
                                </div>
                            ) : chamados.length === 0 ? (
                                <div className="chat-lista-vazio">
                                    <span>📭</span>
                                    <p>Nenhum chamado em aberto</p>
                                </div>
                            ) : (
                                chamados.map(c => {
                                    const statusCfg =
                                        STATUS_CONFIG[
                                            c.statusAtual as ChamadoStatus
                                        ];
                                    const ativo = chamadoAtivo?.id === c.id;
                                    // SLA alerta para este chamado
                                    const alerta = alertasSla.find(
                                        a => a.chamadoId === c.id,
                                    );
                                    return (
                                        <button
                                            key={c.id}
                                            className={`chat-item ${ativo ? "ativo" : ""} ${alerta ? "chat-item-alerta" : ""}`}
                                            onClick={() => selecionarChamado(c)}
                                        >
                                            {alerta && (
                                                <span
                                                    className="chat-item-sla"
                                                    style={{
                                                        color: SLA_CONFIG[
                                                            alerta.nivel
                                                        ].cor,
                                                    }}
                                                    title={alerta.mensagem}
                                                >
                                                    {
                                                        SLA_CONFIG[alerta.nivel]
                                                            .icone
                                                    }
                                                </span>
                                            )}
                                            <div className="chat-item-avatar">
                                                {(c.contatoNome || "?")
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>
                                            <div className="chat-item-info">
                                                <div className="chat-item-topo">
                                                    <span className="chat-item-nome">
                                                        {c.contatoNome || "—"}
                                                    </span>
                                                    <span
                                                        className="chat-item-status"
                                                        style={{
                                                            color: statusCfg?.cor,
                                                        }}
                                                    >
                                                        {statusCfg?.icone}
                                                    </span>
                                                </div>
                                                <div className="chat-item-preview">
                                                    {c.texto
                                                        ? c.texto.slice(0, 50) +
                                                          (c.texto.length > 50
                                                              ? "…"
                                                              : "")
                                                        : "Sem descrição"}
                                                </div>
                                                <div className="chat-item-data">
                                                    {formatarDataHora(
                                                        c.dtAbertura,
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* Fila de triagem (aba Triagem) */}
                    {aba === "triagem" && (
                        <div className="chat-lista">
                            {loadingTriagem ? (
                                <div className="chat-lista-vazio">
                                    Carregando...
                                </div>
                            ) : filaAgrupada.length === 0 ? (
                                <div className="chat-lista-vazio">
                                    <span>✅</span>
                                    <p>
                                        Fila limpa — nenhuma mensagem pendente
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Banner de pendentes de vinculação */}
                                    {totalPendentesVinculacao > 0 && (
                                        <div
                                            style={{
                                                padding: "8px 12px",
                                                background:
                                                    "rgba(245,158,11,.08)",
                                                borderBottom:
                                                    "1px solid rgba(245,158,11,.25)",
                                                fontSize: 12,
                                                color: "#92400e",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                gap: 8,
                                            }}
                                        >
                                            <span>
                                                🔗{" "}
                                                <strong>
                                                    {totalPendentesVinculacao}
                                                </strong>{" "}
                                                contato(s) sem vínculo com
                                                Cliente
                                            </span>
                                            <button
                                                className="btn-secondary btn-sm"
                                                onClick={() =>
                                                    navigate("contatos")
                                                }
                                            >
                                                Vincular
                                            </button>
                                        </div>
                                    )}

                                    {/* Barra de ações quando há seleção */}
                                    {selecionados.size > 0 && (
                                        <div className="triagem-acoes">
                                            <span>
                                                {selecionados.size}{" "}
                                                selecionado(s)
                                            </span>
                                            <button
                                                className="btn-primary btn-sm"
                                                onClick={abrirModalCriar}
                                            >
                                                + Criar Chamado
                                            </button>
                                        </div>
                                    )}

                                    {/* Lista de grupos */}
                                    {filaAgrupada.map(item => {
                                        const pendente =
                                            item.pendenteVinculacao;
                                        const selecionado = selecionados.has(
                                            item.contatoId,
                                        );
                                        return (
                                            <button
                                                key={item.contatoId}
                                                className={`chat-item ${selecionado ? "selecionado" : ""}`}
                                                onClick={() =>
                                                    toggleSelecionado(
                                                        item.contatoId,
                                                    )
                                                }
                                                style={
                                                    pendente
                                                        ? {
                                                              borderLeft:
                                                                  "3px solid #f59e0b",
                                                              paddingLeft: 11,
                                                          }
                                                        : undefined
                                                }
                                            >
                                                <div className="chat-item-checkbox">
                                                    {selecionado ? "☑️" : "☐"}
                                                </div>
                                                <div className="chat-item-avatar chat-item-avatar-cliente">
                                                    {item.nomeContato
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>
                                                <div className="chat-item-info">
                                                    <div className="chat-item-topo">
                                                        <span className="chat-item-nome">
                                                            {item.nomeContato}
                                                            {pendente && (
                                                                <span
                                                                    title="Contato sem vínculo com Cliente — vincule antes de criar chamado"
                                                                    style={{
                                                                        marginLeft: 5,
                                                                        fontSize: 12,
                                                                    }}
                                                                >
                                                                    🔗
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="chat-item-contagem">
                                                            {
                                                                item.totalMensagens
                                                            }{" "}
                                                            msg
                                                        </span>
                                                    </div>
                                                    <div className="chat-item-preview">
                                                        {previewMidia(item)}
                                                    </div>
                                                    <div className="chat-item-data">
                                                        {formatarDataCurta(
                                                            item.dtUltimaMensagem,
                                                        )}{" "}
                                                        {formatarHora(
                                                            item.dtUltimaMensagem,
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Área de conversa ─────────────────────────────────────────────── */}
                <div className="chat-conteudo">
                    {!chamadoAtivo && aba === "atendimento" ? (
                        <div className="chat-vazio">
                            <span className="chat-vazio-icone">💬</span>
                            <h3>Selecione um chamado</h3>
                            <p>
                                Escolha um chamado na lista para iniciar o
                                atendimento
                            </p>
                        </div>
                    ) : aba === "triagem" ? (
                        <div className="chat-vazio">
                            <span className="chat-vazio-icone">📥</span>
                            <h3>Fila de Triagem</h3>
                            <p>
                                Selecione um ou mais contatos na lista e clique
                                em <strong>Criar Chamado</strong>
                            </p>
                            {totalPendentesVinculacao > 0 && (
                                <p
                                    style={{
                                        fontSize: 12,
                                        color: "#92400e",
                                        background: "rgba(245,158,11,.08)",
                                        padding: "8px 14px",
                                        borderRadius: 8,
                                        border: "1px solid rgba(245,158,11,.25)",
                                        marginTop: 8,
                                    }}
                                >
                                    🔗 Contatos marcados com <strong>🔗</strong>{" "}
                                    precisam ser vinculados a um Cliente antes
                                    de criar chamado.
                                </p>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Header da conversa */}
                            <div className="chat-header-conversa">
                                <div className="chat-header-avatar">
                                    {(chamadoAtivo!.contatoNome || "?")
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>
                                <div className="chat-header-info">
                                    <strong>{chamadoAtivo!.contatoNome}</strong>
                                    {(() => {
                                        const cfg =
                                            STATUS_CONFIG[
                                                chamadoAtivo!
                                                    .statusAtual as ChamadoStatus
                                            ];
                                        return (
                                            <span
                                                className="chat-header-status"
                                                style={{
                                                    color: cfg?.cor,
                                                    background: cfg?.bg,
                                                    border: `1px solid ${cfg?.border}`,
                                                }}
                                            >
                                                {cfg?.icone} {cfg?.label}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <button
                                    className="btn-secondary btn-sm"
                                    onClick={() => setChamadoAtivo(null)}
                                    style={{ marginLeft: "auto" }}
                                >
                                    ✕ Fechar
                                </button>
                            </div>

                            {/* Mensagens */}
                            <div className="chat-mensagens">
                                {loadingMsgs ? (
                                    <div className="chat-msgs-loading">
                                        Carregando mensagens...
                                    </div>
                                ) : mensagens.length === 0 ? (
                                    <div className="chat-msgs-vazio">
                                        <p>Nenhuma mensagem ainda</p>
                                    </div>
                                ) : (
                                    <>
                                        {mensagens.map((msg, i) => {
                                            const isSuporteMsg =
                                                msg.origem === "SUPORTE";
                                            const msgAnterior =
                                                mensagens[i - 1];
                                            const mesmoDia =
                                                msgAnterior &&
                                                new Date(
                                                    msgAnterior.dtEnvio || "",
                                                ).toDateString() ===
                                                    new Date(
                                                        msg.dtEnvio || "",
                                                    ).toDateString();

                                            return (
                                                <div key={msg.id}>
                                                    {!mesmoDia && (
                                                        <div className="chat-separador-data">
                                                            <span>
                                                                {formatarDataCurta(
                                                                    msg.dtEnvio,
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div
                                                        className={`chat-msg ${isSuporteMsg ? "chat-msg-suporte" : "chat-msg-cliente"}`}
                                                    >
                                                        {!isSuporteMsg && (
                                                            <div className="chat-msg-avatar">
                                                                {(
                                                                    msg.nomeContato ||
                                                                    "?"
                                                                )
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div className="chat-msg-balao">
                                                            {!isSuporteMsg && (
                                                                <span className="chat-msg-remetente">
                                                                    {
                                                                        msg.nomeContato
                                                                    }
                                                                </span>
                                                            )}
                                                            {msg.tipoMidia ===
                                                                "IMAGEM" &&
                                                            msg.fileUrl ? (
                                                                <img
                                                                    src={
                                                                        msg.fileUrl
                                                                    }
                                                                    alt="imagem"
                                                                    className="chat-msg-imagem"
                                                                />
                                                            ) : msg.tipoMidia ===
                                                                  "AUDIO" &&
                                                              msg.fileUrl ? (
                                                                <audio
                                                                    controls
                                                                    src={
                                                                        msg.fileUrl
                                                                    }
                                                                    className="chat-msg-audio"
                                                                />
                                                            ) : (
                                                                <p className="chat-msg-texto">
                                                                    {msg.texto}
                                                                </p>
                                                            )}
                                                            <span className="chat-msg-hora">
                                                                {formatarHora(
                                                                    msg.dtEnvio,
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={fimMensagensRef} />
                                    </>
                                )}
                            </div>

                            {/* Input de resposta */}
                            {chamadoAtivo!.statusAtual !== "ENCERRADO" ? (
                                <div className="chat-input-area">
                                    <textarea
                                        ref={inputRef}
                                        className="chat-input"
                                        placeholder="Digite sua resposta… (Enter para enviar, Shift+Enter para nova linha)"
                                        value={texto}
                                        onChange={e => setTexto(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        rows={2}
                                        disabled={enviando}
                                    />
                                    <button
                                        className="chat-btn-enviar"
                                        onClick={enviarMensagem}
                                        disabled={!texto.trim() || enviando}
                                        title="Enviar (Enter)"
                                    >
                                        {enviando ? "⏳" : "➤"}
                                    </button>
                                </div>
                            ) : (
                                <div className="chat-encerrado-aviso">
                                    🔒 Este chamado está encerrado. Não é
                                    possível enviar mensagens.
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ── Modal Criar Chamado (da triagem) ─────────────────────────────── */}
                {modalCriarChamado && (
                    <div
                        className="modal-overlay"
                        onClick={() => setModalCriarChamado(false)}
                    >
                        <div
                            className="modal modal-sm"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h3>Criar Chamado</h3>
                                <button
                                    className="modal-fechar"
                                    onClick={() => setModalCriarChamado(false)}
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="modal-body">
                                <p
                                    style={{
                                        fontSize: 13,
                                        color: "var(--color-text-muted)",
                                        marginBottom: 14,
                                    }}
                                >
                                    Criando a partir de{" "}
                                    <strong>{itensSelecionados.length}</strong>{" "}
                                    contato(s) selecionado(s)
                                </p>
                                <div
                                    className="form-grid"
                                    style={{ gridTemplateColumns: "1fr" }}
                                >
                                    <div className="form-group">
                                        <label>Categoria</label>
                                        <select
                                            title="categoria"
                                            value={formCriar.categoria}
                                            onChange={e =>
                                                setFormCriar(f => ({
                                                    ...f,
                                                    categoria: e.target
                                                        .value as
                                                        | "ERRO"
                                                        | "DUVIDA",
                                                }))
                                            }
                                        >
                                            <option value="DUVIDA">
                                                ❓ Dúvida
                                            </option>
                                            <option value="ERRO">
                                                🔴 Erro
                                            </option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Descrição inicial</label>
                                        <textarea
                                            rows={3}
                                            value={formCriar.texto}
                                            onChange={e =>
                                                setFormCriar(f => ({
                                                    ...f,
                                                    texto: e.target.value,
                                                }))
                                            }
                                            placeholder="Texto inicial do chamado..."
                                            style={{ resize: "vertical" }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    className="btn-secondary"
                                    onClick={() => setModalCriarChamado(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={criarChamadoDeTriagem}
                                    disabled={criando}
                                >
                                    {criando ? "Criando..." : "+ Criar Chamado"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
