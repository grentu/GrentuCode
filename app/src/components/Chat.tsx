import type { ConsultationVM, MessageVM } from "../types.js";

function Message({ msg }: { msg: MessageVM }) {
  return (
    <div className={`msg ${msg.authorKind}`}>
      <div className="who">
        {msg.authorKind === "agent" ? msg.author : `${msg.author} · ${msg.time}`}
      </div>
      <div className="bubble">{msg.text}</div>
    </div>
  );
}

function Consultation({ c }: { c: ConsultationVM }) {
  return (
    <div className="consult">
      <div className="title">СОВЕЩАНИЕ · {c.pairLabel}</div>
      {c.replies.map((r, i) => (
        <div className="line" key={i}>
          <span className="dot">{r.who}</span>
          {r.text}
        </div>
      ))}
    </div>
  );
}

export function Chat({
  task,
  subtitle,
  messages,
  consultation,
}: {
  task: string;
  subtitle: string;
  messages: MessageVM[];
  consultation: ConsultationVM;
}) {
  return (
    <div className="chat">
      <div className="head">
        <b>{task}</b>
        <span>{subtitle}</span>
      </div>
      <div className="stream">
        {messages.map((m) => (
          <Message key={m.id} msg={m} />
        ))}
        <Consultation c={consultation} />
      </div>
      <div className="composer">
        <input placeholder="Напишите задачу или сообщение..." />
        <button aria-label="Отправить">↑</button>
      </div>
    </div>
  );
}
