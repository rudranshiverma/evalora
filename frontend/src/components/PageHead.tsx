import type { ReactNode } from "react";
import { Stepper } from "./Stepper";

interface Props {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  step?: number;
}

export function PageHead({ title, subtitle, actions, step }: Props) {
  return (
    <section className={`pagehead ${step === undefined ? "pagehead--plain" : ""}`}>
      <div className="pagehead__inner">
        <div className="pagehead__row">
          <div>
            <h1 className="pagehead__title">{title}</h1>
            {subtitle && <p className="pagehead__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="pagehead__actions">{actions}</div>}
        </div>
        {step !== undefined && <Stepper current={step} />}
      </div>
    </section>
  );
}