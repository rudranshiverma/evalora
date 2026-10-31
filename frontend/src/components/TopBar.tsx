import type { Health } from "../types";

export type HealthState = Health | "offline" | null;
export type Section = "new" | "past";

function status(health: Exclude<HealthState, null>) {
  if (health === "offline") {
    return { tone: "off", label: "Server offline", title: "Start the backend, then reload." };
  }
  if (health.mock_grader) {
    return { tone: "warn", label: "Mock grader", title: "Grades are simulated. No Gemini calls." };
  }
  if (!health.api_key_set) {
    return { tone: "off", label: "No API key", title: "Add GEMINI_API_KEY to the .env file." };
  }
  return { tone: "ok", label: health.model, title: "Model used for grading" };
}

const LINKS: { section: Section; href: string; label: string }[] = [
  { section: "new", href: "#/rubric", label: "New batch" },
  { section: "past", href: "#/runs", label: "Past batches" },
];

export function TopBar({ health, section }: { health: HealthState; section: Section }) {
  const chip = health && status(health);

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <a className="brand" href="#/rubric">
          Evalora
        </a>
        <nav className="nav" aria-label="Main">
          {LINKS.map((link) => (
            <a
              key={link.section}
              href={link.href}
              className={`nav__link ${link.section === section ? "is-active" : ""}`}
              aria-current={link.section === section ? "page" : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
        {chip && (
          <span className="chip" title={chip.title}>
            <span className={`chip__dot chip__dot--${chip.tone}`} />
            {chip.label}
          </span>
        )}
      </div>
    </header>
  );
}