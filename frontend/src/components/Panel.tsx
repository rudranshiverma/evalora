import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  meta?: ReactNode;
  children: ReactNode;
}

export function Panel({ icon, title, description, meta, children }: Props) {
  return (
    <section className="panel">
      <div className="panel__head">
        <span className="panel__icon">{icon}</span>
        <div className="panel__heading">
          <h2 className="panel__title">{title}</h2>
          {description && <p className="panel__desc">{description}</p>}
        </div>
        {meta && <div className="panel__meta">{meta}</div>}
      </div>
      {children}
    </section>
  );
}