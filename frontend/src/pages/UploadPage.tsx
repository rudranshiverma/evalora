import { useRef, useState } from "react";
import { api } from "../api";
import { ListIcon, UploadIcon, XIcon } from "../components/Icons";
import { PageHead } from "../components/PageHead";
import { Panel } from "../components/Panel";
import { RubricSummary } from "../components/RubricSummary";
import { formatSize, plural } from "../format";
import { validateRubric } from "../rubric";
import { navigate } from "../router";
import type { RubricDraft } from "../types";

const ACCEPTED = [".pdf", ".docx", ".txt", ".md"];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 200;

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function UploadPage({ draft }: { draft: RubricDraft }) {
  const [files, setFiles] = useState<File[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rubricReady = validateRubric(draft) === null;
  const tooMany = files.length > MAX_FILES;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files];
    const rejected: string[] = [];
    for (const file of Array.from(incoming)) {
      if (!ACCEPTED.includes(extension(file.name))) {
        rejected.push(`${file.name} (unsupported type)`);
      } else if (file.size > MAX_BYTES) {
        rejected.push(`${file.name} (over 10 MB)`);
      } else if (!next.some((f) => f.name === file.name && f.size === file.size)) {
        next.push(file);
      }
    }
    setFiles(next);
    setSkipped(rejected);
  };

  const upload = async () => {
    setUploading(true);
    setError(null);
    try {
      const detail = await api.createRun(draft, files);
      navigate(`/runs/${detail.run.id}`);
    } catch (e) {
      setError((e as Error).message);
      setUploading(false);
    }
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <>
      <PageHead
        title="Upload submissions"
        subtitle="Add one file per student. File names become student names, and you can edit them before grading starts."
        step={1}
      />
      <div className="container stack">
        {!rubricReady && (
          <div className="alert alert--warning">
            The rubric is incomplete. <a href="#/rubric">Finish the rubric</a> before uploading.
          </div>
        )}
        {error && <div className="alert alert--error">{error}</div>}
        <div className="layout">
          <Panel
            icon={<UploadIcon />}
            title="Submissions"
            description="PDF, DOCX or TXT, up to 10 MB each."
            meta={
              files.length > 0 && (
                <span className="badge badge--info badge--lg">{plural(files.length, "file")}</span>
              )
            }
          >
            <div className="panel__body stack stack--tight">
              <div
                className={`dropzone ${dragging ? "dropzone--active" : ""}`}
                role="button"
                tabIndex={0}
                onClick={openPicker}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPicker();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  addFiles(e.dataTransfer.files);
                }}
              >
                <span className="dropzone__icon">
                  <UploadIcon />
                </span>
                <p className="dropzone__title">Drop files here or click to choose</p>
                <p className="hint">One file per student</p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED.join(",")}
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
              {skipped.length > 0 && (
                <div className="alert alert--warning">Skipped: {skipped.join(", ")}</div>
              )}
              {tooMany && (
                <div className="alert alert--error">
                  Upload at most {MAX_FILES} files at a time. Remove some and try again.
                </div>
              )}
            </div>
            {files.length > 0 && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th className="num">Size</th>
                      <th aria-label="Remove" />
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, i) => (
                      <tr key={`${file.name}-${file.size}`}>
                        <td className="file-cell">{file.name}</td>
                        <td className="num muted">{formatSize(file.size)}</td>
                        <td className="num">
                          <button
                            className="icon-btn"
                            onClick={() => setFiles(files.filter((_, j) => j !== i))}
                            disabled={uploading}
                            aria-label={`Remove ${file.name}`}
                            title="Remove file"
                          >
                            <XIcon />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <aside className="aside">
            <Panel
              icon={<ListIcon />}
              title={draft.title.trim() || "Untitled rubric"}
              description="The rubric these files will be graded against."
            >
              <div className="panel__body">
                <RubricSummary draft={draft} />
                <div className="summary__actions">
                  <button
                    className="btn btn--primary btn--block"
                    onClick={upload}
                    disabled={!rubricReady || files.length === 0 || tooMany || uploading}
                  >
                    {uploading ? "Uploading..." : `Upload ${plural(files.length, "file")}`}
                  </button>
                  <a className="btn btn--block" href="#/rubric">
                    Edit rubric
                  </a>
                </div>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </>
  );
}