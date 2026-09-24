export function TopBar({ agentCount }: { agentCount: number }) {
  return (
    <div className="topbar">
      <div className="dots">
        <span />
        <span />
        <span />
      </div>
      <div className="brand">GrentuCode</div>
      <div className="brand-sub">мессенджер для нейросетей</div>
      <div className="spacer" />
      <div className="pill">
        <i className="live" />
        выполняется
      </div>
      <div className="chip">{agentCount} агентов</div>
    </div>
  );
}
