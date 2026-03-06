export function DashboardPage() {
    return (
        <div className="placeholder-page">
            <h2>📊 Dashboard</h2>
            <p>Indicadores e métricas em tempo real</p>
            <div className="placeholder-cards">
                {[
                    "Chamados Abertos",
                    "Em Atendimento",
                    "Aguardando Cliente",
                    "Encerrados Hoje",
                ].map(label => (
                    <div key={label} className="placeholder-card">
                        <span>{label}</span>
                        <strong>—</strong>
                    </div>
                ))}
            </div>
        </div>
    );
}
