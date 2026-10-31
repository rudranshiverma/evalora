import { useEffect, useState } from "react";

export type Route =
  | { page: "rubric" }
  | { page: "upload" }
  | { page: "runs" }
  | { page: "run"; runId: string };

export function parseRoute(hash: string): Route {
  const [first, second] = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (first === "upload") return { page: "upload" };
  if (first === "runs" && second) return { page: "run", runId: decodeURIComponent(second) };
  if (first === "runs") return { page: "runs" };
  return { page: "rubric" };
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}
