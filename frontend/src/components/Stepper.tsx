import { CheckIcon } from "./Icons";

const STEPS = ["Rubric", "Upload", "Grading", "Results"];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="steps">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <li
            key={label}
            className={`step step--${state}`}
            aria-current={i === current ? "step" : undefined}
          >
            <span className="step__num">{state === "done" ? <CheckIcon /> : i + 1}</span>
            <span className="step__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}