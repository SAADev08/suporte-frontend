import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import type { Tipo, Subtipo } from "../../types";
import { typeApi } from "../../services/api/typeApi";
import "./types.css";

// ─── Componente principal ─────────────────────────────────────────────────────
export function TypesPage() {
    const [tipos, setTipos] = useState<Tipo[]>([]);
    const [subtipos, setSubtipos] = useState<Subtipo[]>([]);
    const [tipoSelecionado, setTipoSelecionado] = useState<Tipo | null>(null);
    const [loadingTipos, setLoadingTipos] = useState(true);
    const [loadingSubtipos, setLoadingSubtipos] = useState(false);

    // ─── Modais ─────────────────────────────────────────────────────────────────
    const [modalTipo, setModalTipo] = useState(false);
    const [modalSubtipo, setModalSubtipo] = useState(false);
    const [nomeNovoTipo, setNomeNovoTipo] = useState("");
    const [nomeNovoSubtipo, setNomeNovoSubtipo] = useState("");
    const [erroTipo, setErroTipo] = useState("");
    const [erroSubtipo, setErroSubtipo] = useState("");
    const [salvando, setSalvando] = useState(false);

    // ─── Carregar tipos ──────────────────────────────────────────────────────────
    const carregarTipos = useCallback(async () => {
        setLoadingTipos(true);
        try {
            const { data } = await typeApi.listar();
            setTipos(data);
            // Se havia um tipo selecionado, mantém a seleção com dados atualizados
            if (tipoSelecionado) {
                const atualizado = data.find(t => t.id === tipoSelecionado.id);
                if (atualizado) setTipoSelecionado(atualizado);
            }
        } catch {
            toast.error("Erro ao carregar tipos");
        } finally {
            setLoadingTipos(false);
        }
    }, [tipoSelecionado]);

    useEffect(() => {
        carregarTipos();
    }, []); // eslint-disable-line

    // ─── Carregar subtipos ao selecionar tipo ────────────────────────────────────
    const selecionarTipo = useCallback(async (tipo: Tipo) => {
        setTipoSelecionado(tipo);
        setLoadingSubtipos(true);
        try {
            const { data } = await typeApi.listarSubtipos(tipo.id);
            setSubtipos(data);
        } catch {
            toast.error("Erro ao carregar subtipos");
        } finally {
            setLoadingSubtipos(false);
        }
    }, []);

    // ─── Criar tipo ──────────────────────────────────────────────────────────────
    const abrirModalTipo = () => {
        setNomeNovoTipo("");
        setErroTipo("");
        setModalTipo(true);
    };

    const salvarTipo = async () => {
        if (!nomeNovoTipo.trim()) {
            setErroTipo("Nome é obrigatório");
            return;
        }
        setSalvando(true);
        try {
            const { data } = await typeApi.criar({ nome: nomeNovoTipo.trim() });
            toast.success(`Tipo "${data.nome}" criado com sucesso!`);
            setModalTipo(false);
            // Recarrega e já seleciona o novo tipo
            const { data: lista } = await typeApi.listar();
            setTipos(lista);
            const novo = lista.find(t => t.id === data.id);
            if (novo) selecionarTipo(novo);
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message || "Erro ao criar tipo";
            toast.error(msg);
        } finally {
            setSalvando(false);
        }
    };

    // ─── Criar subtipo ────────────────────────────────────────────────────────────
    const abrirModalSubtipo = () => {
        setNomeNovoSubtipo("");
        setErroSubtipo("");
        setModalSubtipo(true);
    };

    const salvarSubtipo = async () => {
        if (!tipoSelecionado) return;
        if (!nomeNovoSubtipo.trim()) {
            setErroSubtipo("Nome é obrigatório");
            return;
        }
        setSalvando(true);
        try {
            await typeApi.criarSubtipo(tipoSelecionado.id, {
                nome: nomeNovoSubtipo.trim(),
            });
            toast.success(`Subtipo criado com sucesso!`);
            setModalSubtipo(false);
            // Recarrega subtipos do tipo atual
            const { data } = await typeApi.listarSubtipos(tipoSelecionado.id);
            setSubtipos(data);
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message || "Erro ao criar subtipo";
            toast.error(msg);
        } finally {
            setSalvando(false);
        }
    };

    // ─── Enter nos inputs ────────────────────────────────────────────────────────
    const onKeyTipo = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") salvarTipo();
    };
    const onKeySubtipo = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") salvarSubtipo();
    };

    // ─── Render ──────────────────────────────────────────────────────────────────
    return (
        <div className="modulo">
            {/* Cabeçalho */}
            <div className="modulo-header">
                <div>
                    <h2 className="modulo-titulo">Tipos e Subtipos</h2>
                    <p className="modulo-subtitulo">
                        Categorias para classificação dos chamados
                    </p>
                </div>
                <button className="btn-primary" onClick={abrirModalTipo}>
                    + Novo Tipo
                </button>
            </div>

            {/* Layout dois painéis */}
            <div className="tipos-layout">
                {/* Painel esquerdo — lista de tipos */}
                <div className="tipos-painel">
                    <div className="tipos-painel-header">
                        <span className="tipos-painel-titulo">Tipos</span>
                        <span className="tipos-painel-count">
                            {tipos.length}
                        </span>
                    </div>

                    {loadingTipos ? (
                        <div className="tipos-loading">Carregando...</div>
                    ) : tipos.length === 0 ? (
                        <div className="tipos-vazio">
                            <p>Nenhum tipo cadastrado.</p>
                            <button
                                className="btn-primary"
                                style={{ marginTop: 8 }}
                                onClick={abrirModalTipo}
                            >
                                Criar primeiro tipo
                            </button>
                        </div>
                    ) : (
                        <ul className="tipos-lista">
                            {tipos.map(t => (
                                <li key={t.id}>
                                    <button
                                        className={`tipo-item ${tipoSelecionado?.id === t.id ? "ativo" : ""}`}
                                        onClick={() => selecionarTipo(t)}
                                    >
                                        <span className="tipo-item-icon">
                                            📂
                                        </span>
                                        <span className="tipo-item-nome">
                                            {t.nome}
                                        </span>
                                        <span
                                            className={`badge ${t.ativo ? "badge-ativo" : "badge-inativo"}`}
                                        >
                                            {t.ativo ? "Ativo" : "Inativo"}
                                        </span>
                                        <span className="tipo-item-seta">
                                            ›
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Painel direito — subtipos do tipo selecionado */}
                <div className="tipos-painel tipos-painel-subtipos">
                    {!tipoSelecionado ? (
                        <div className="subtipos-placeholder">
                            <span className="subtipos-placeholder-icon">
                                👈
                            </span>
                            <p>Selecione um tipo para ver seus subtipos</p>
                        </div>
                    ) : (
                        <>
                            <div className="tipos-painel-header">
                                <div>
                                    <span className="tipos-painel-titulo">
                                        Subtipos de
                                    </span>
                                    <span className="tipos-painel-titulo tipos-painel-titulo-destaque">
                                        &nbsp;{tipoSelecionado.nome}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <span className="tipos-painel-count">
                                        {subtipos.length}
                                    </span>
                                    <button
                                        className="btn-primary btn-sm"
                                        onClick={abrirModalSubtipo}
                                    >
                                        + Subtipo
                                    </button>
                                </div>
                            </div>

                            {loadingSubtipos ? (
                                <div className="tipos-loading">
                                    Carregando subtipos...
                                </div>
                            ) : subtipos.length === 0 ? (
                                <div className="tipos-vazio">
                                    <p>
                                        Nenhum subtipo cadastrado para{" "}
                                        <strong>{tipoSelecionado.nome}</strong>.
                                    </p>
                                    <button
                                        className="btn-primary"
                                        style={{ marginTop: 8 }}
                                        onClick={abrirModalSubtipo}
                                    >
                                        Criar primeiro subtipo
                                    </button>
                                </div>
                            ) : (
                                <ul className="subtipos-lista">
                                    {subtipos.map(s => (
                                        <li key={s.id} className="subtipo-item">
                                            <span className="subtipo-item-icon">
                                                🏷️
                                            </span>
                                            <span className="subtipo-item-nome">
                                                {s.nome}
                                            </span>
                                            <span
                                                className={`badge ${s.ativo ? "badge-ativo" : "badge-inativo"}`}
                                            >
                                                {s.ativo ? "Ativo" : "Inativo"}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modal — Novo Tipo */}
            {modalTipo && (
                <div
                    className="modal-overlay"
                    onClick={() => setModalTipo(false)}
                >
                    <div
                        className="modal modal-sm"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3>Novo Tipo</h3>
                            <button
                                className="modal-fechar"
                                onClick={() => setModalTipo(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>
                                    Nome <span className="obrigatorio">*</span>
                                </label>
                                <input
                                    autoFocus
                                    value={nomeNovoTipo}
                                    onChange={e => {
                                        setNomeNovoTipo(e.target.value);
                                        setErroTipo("");
                                    }}
                                    onKeyDown={onKeyTipo}
                                    placeholder="Ex: Suporte Técnico"
                                    className={erroTipo ? "input-erro" : ""}
                                />
                                {erroTipo && (
                                    <span className="erro-msg">{erroTipo}</span>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setModalTipo(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-primary"
                                onClick={salvarTipo}
                                disabled={salvando}
                            >
                                {salvando ? "Criando..." : "Criar Tipo"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal — Novo Subtipo */}
            {modalSubtipo && tipoSelecionado && (
                <div
                    className="modal-overlay"
                    onClick={() => setModalSubtipo(false)}
                >
                    <div
                        className="modal modal-sm"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3>Novo Subtipo</h3>
                            <button
                                className="modal-fechar"
                                onClick={() => setModalSubtipo(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="tipo-contexto">
                                <span className="tipo-contexto-label">
                                    Tipo
                                </span>
                                <span className="tipo-contexto-nome">
                                    {tipoSelecionado.nome}
                                </span>
                            </div>
                            <div
                                className="form-group"
                                style={{ marginTop: 14 }}
                            >
                                <label>
                                    Nome <span className="obrigatorio">*</span>
                                </label>
                                <input
                                    autoFocus
                                    value={nomeNovoSubtipo}
                                    onChange={e => {
                                        setNomeNovoSubtipo(e.target.value);
                                        setErroSubtipo("");
                                    }}
                                    onKeyDown={onKeySubtipo}
                                    placeholder="Ex: Lentidão no sistema"
                                    className={erroSubtipo ? "input-erro" : ""}
                                />
                                {erroSubtipo && (
                                    <span className="erro-msg">
                                        {erroSubtipo}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setModalSubtipo(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-primary"
                                onClick={salvarSubtipo}
                                disabled={salvando}
                            >
                                {salvando ? "Criando..." : "Criar Subtipo"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
