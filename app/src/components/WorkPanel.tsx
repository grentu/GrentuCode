import type { RunState } from "../types.js";

const CHUNK_STATE_LABEL: Record<string, string> = {
  done: "пройдено",
  fixing: "чинится",
  waiting: "ждёт",
};

export function WorkPanel({ run }: { run: RunState }) {
  const { plan, contract, tests, budgets, status } = run;
  return (
    <div className="rail-right">
      <div className="head">
        <b>Работа</b>
        <span>состояние прогона</span>
      </div>

      {/* план */}
      <div className="wcard">
        <h4>План</h4>
        {plan.map((c) => (
          <div className="planrow" key={c.id}>
            <span className={`ind ${c.state === "done" ? "active" : c.state === "fixing" ? "typing" : "idle"}`}>
              {c.state === "fixing" ? (
                <>
                  <i />
                  <i />
                  <i />
                </>
              ) : (
                <i />
              )}
            </span>
            {c.label} · {c.owner}
            <span className="state">{CHUNK_STATE_LABEL[c.state]}</span>
          </div>
        ))}
      </div>

      {/* контракт */}
      <div className="wcard">
        <div className="cardhead">
          <h4>Контракт · spec.md</h4>
          <div className="badges">
            {contract.frozen && <span className="badge">заморожен</span>}
            <span className="badge hist">v{contract.version} · история ⟲</span>
          </div>
        </div>
        {contract.clauses.map((cl) => (
          <div className="clause" key={cl.id}>
            {cl.id} · {cl.signature}
          </div>
        ))}
        <div className="note">
          версия {contract.version} · план-критик перерезал {contract.reslices}× до заморозки
        </div>
        <div className="note dim">пишет только оркестратор, авторы не трогают</div>
      </div>

      {/* тесты */}
      <div className="wcard">
        <div className="cardhead">
          <h4>Тесты · интеграция + стыки</h4>
          <b style={{ fontSize: 12, color: "var(--fg-2)" }}>
            {tests.passed} / {tests.total}
          </b>
        </div>
        <div className="bar" style={{ marginBottom: 12 }}>
          <i style={{ width: `${(tests.passed / tests.total) * 100}%` }} />
        </div>
        {tests.items.map((t) => (
          <div className={`testline ${t.passed ? "" : "failed"}`} key={t.id}>
            <span className="mark">{t.passed ? "✓" : "✕"}</span>
            {t.label}
          </div>
        ))}
      </div>

      {/* бюджеты */}
      <div className="wcard">
        <h4>Бюджеты · по куску, не общий</h4>
        {budgets.map((b) => (
          <div className={`budget ${b.emphasize ? "emph" : ""}`} key={b.key}>
            <label>{b.label}</label>
            <div className="bar">
              <i style={{ width: `${(b.used / b.max) * 100}%` }} />
            </div>
            <span className="val">
              {b.used} / {b.max}
            </span>
          </div>
        ))}
      </div>

      {/* статус */}
      <div className="wcard status">
        <div className="light" />
        <div>
          <b>{status.title}</b>
          <p>{status.detail}</p>
        </div>
      </div>
    </div>
  );
}
