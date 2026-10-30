import {
  Download,
  ExternalLink,
  File,
  FileImage,
  Link2,
  LoaderCircle,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Evidence } from "../types";
import { useStore } from "../store";
import {
  createStoredFileUrl,
  deleteEvidenceFile,
  downloadStoredFile,
  saveEvidenceFile,
} from "../storage/files";
import {
  Button,
  ConfirmDialog,
  Field,
  IconButton,
  Modal,
  Tabs,
  useToast,
} from "./ui";

type EvidenceKind = "text" | "link" | "file";

function EvidencePreview({ evidence }: { evidence: Evidence }) {
  const [objectUrl, setObjectUrl] = useState("");
  const isImage =
    evidence.type === "image" && Boolean(evidence.fileId);

  useEffect(() => {
    if (!isImage || !evidence.fileId) return;
    let active = true;
    let createdUrl = "";
    createStoredFileUrl(evidence.fileId).then((url) => {
      if (active) {
        createdUrl = url;
        setObjectUrl(url);
      }
    });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [evidence.fileId, isImage]);

  if (isImage) {
    return objectUrl ? (
      <a
        className="evidence-image-preview"
        href={objectUrl}
        target="_blank"
        rel="noreferrer"
      >
        <img src={objectUrl} alt={evidence.title} />
      </a>
    ) : (
      <span className="evidence-preview-loading">
        <LoaderCircle className="spin" size={16} />
      </span>
    );
  }

  if (evidence.type === "file") {
    return (
      <div className="evidence-file-row">
        <File size={17} />
        <span>
          <strong>{evidence.fileName || evidence.title}</strong>
          <small>
            {evidence.fileSize
              ? `${Math.max(1, Math.round(evidence.fileSize / 1024))} KB`
              : "本地文件"}
          </small>
        </span>
      </div>
    );
  }

  if (evidence.type === "link") {
    return (
      <a
        className="evidence-link"
        href={evidence.url}
        target="_blank"
        rel="noreferrer"
      >
        <Link2 size={15} />
        <span>{evidence.url}</span>
        <ExternalLink size={13} />
      </a>
    );
  }

  return <p className="evidence-text-content">{evidence.content}</p>;
}

export function EvidenceManager({
  taskId,
  sessionId,
  compact = false,
}: {
  taskId?: string;
  sessionId?: string;
  compact?: boolean;
}) {
  const { data, createEvidence, deleteEvidence } = useStore();
  const toast = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [kind, setKind] = useState<EvidenceKind>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Evidence | undefined>();

  const evidenceItems = data.evidence.filter(
    (item) =>
      (taskId && item.taskId === taskId) ||
      (sessionId && item.sessionId === sessionId),
  );
  const linkedTask = taskId
    ? data.tasks.find((task) => task.id === taskId)
    : undefined;

  const openEditor = () => {
    setKind("text");
    setTitle("");
    setContent("");
    setUrl("");
    setSelectedFile(null);
    setError("");
    setEditorOpen(true);
  };

  const save = async () => {
    if (saving) return;
    if (!taskId && !sessionId) {
      setError("请先保存任务，再添加成果。");
      return;
    }
    if (kind === "text" && !content.trim()) {
      setError("请填写文字成果。");
      return;
    }
    if (kind === "link") {
      try {
        new URL(url);
      } catch {
        setError("请输入完整的网页链接，例如 https://example.com。");
        return;
      }
    }
    if (kind === "file" && !selectedFile) {
      setError("请选择图片或文件。");
      return;
    }
    if (selectedFile && selectedFile.size > 25 * 1024 * 1024) {
      setError("单个本地文件不能超过 25 MB。");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (kind === "file" && selectedFile) {
        const fileInfo = await saveEvidenceFile(selectedFile);
        createEvidence({
          taskId,
          projectId: linkedTask?.projectId,
          sessionId,
          type: selectedFile.type.startsWith("image/") ? "image" : "file",
          title: title.trim() || selectedFile.name,
          content: content.trim(),
          ...fileInfo,
        });
      } else {
        createEvidence({
          taskId,
          projectId: linkedTask?.projectId,
          sessionId,
          type: kind,
          title: title.trim() || (kind === "link" ? "参考链接" : "文字成果"),
          content: content.trim(),
          url: kind === "link" ? url.trim() : undefined,
        });
      }
      setEditorOpen(false);
      toast("成果已添加并关联到当前任务");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "成果保存失败。",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`evidence-manager ${compact ? "compact" : ""}`}>
      <div className="evidence-manager-head">
        <div>
          <span className="section-kicker">成果证明</span>
          <h3>已记录 {evidenceItems.length} 项成果</h3>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={Plus}
          onClick={openEditor}
        >
          添加成果
        </Button>
      </div>
      <div className="evidence-list">
        {evidenceItems.map((evidence) => (
          <article className={`evidence-card type-${evidence.type}`} key={evidence.id}>
            <span className="evidence-type-icon">
              {evidence.type === "image" ? (
                <FileImage size={16} />
              ) : evidence.type === "file" ? (
                <Paperclip size={16} />
              ) : evidence.type === "link" ? (
                <Link2 size={16} />
              ) : (
                <File size={16} />
              )}
            </span>
            <div className="evidence-card-main">
              <strong>{evidence.title}</strong>
              {evidence.content ? (
                <p className="evidence-card-summary">{evidence.content}</p>
              ) : null}
              <EvidencePreview evidence={evidence} />
            </div>
            <div className="evidence-card-actions">
              {evidence.fileId ? (
                <IconButton
                  icon={Download}
                  label="下载成果文件"
                  onClick={() =>
                    downloadStoredFile(evidence.fileId!).catch(() =>
                      toast("文件不存在或已被浏览器清理"),
                    )
                  }
                />
              ) : null}
              <IconButton
                icon={Trash2}
                label="删除成果"
                onClick={() => setDeleteTarget(evidence)}
              />
            </div>
          </article>
        ))}
        {!evidenceItems.length ? (
          <div className="evidence-empty">
            <File size={18} />
            <span>还没有成果记录。文字、图片、文件和链接都可以作为证明。</span>
          </div>
        ) : null}
      </div>

      <Modal
        open={editorOpen}
        title="添加成果证明"
        description="成果保存在这个浏览器中；文件不会上传到云端。"
        onClose={() => setEditorOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>
              取消
            </Button>
            <Button onClick={save} disabled={saving} icon={saving ? LoaderCircle : Plus}>
              {saving ? "保存中…" : "保存成果"}
            </Button>
          </>
        }
      >
        <div className="evidence-editor">
          <Tabs
            value={kind}
            onChange={setKind}
            options={[
              { value: "text", label: "文字" },
              { value: "link", label: "链接" },
              { value: "file", label: "图片/文件" },
            ]}
          />
          <Field label="成果标题">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：首页交互演示"
            />
          </Field>
          {kind === "text" ? (
            <Field label="实际成果" required>
              <textarea
                rows={5}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="写下可验证的结果、产出或结论"
              />
            </Field>
          ) : null}
          {kind === "link" ? (
            <>
              <Field label="网页链接" required>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://"
                />
              </Field>
              <Field label="链接说明">
                <textarea
                  rows={3}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                />
              </Field>
            </>
          ) : null}
          {kind === "file" ? (
            <Field label="选择图片或文件" hint="最大 25 MB">
              <label className="file-drop-zone">
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] || null)
                  }
                />
                <Paperclip size={20} />
                <strong>
                  {selectedFile ? selectedFile.name : "点击选择本地文件"}
                </strong>
                <span>
                  {selectedFile
                    ? `${Math.max(1, Math.round(selectedFile.size / 1024))} KB`
                    : "支持图片和常见文档"}
                </span>
              </label>
            </Field>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        description="删除这条成果记录后，关联的本地文件也会被移除。"
        onCancel={() => setDeleteTarget(undefined)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteEvidence(deleteTarget.id);
            if (deleteTarget.fileId) {
              deleteEvidenceFile(deleteTarget.fileId).catch(() => undefined);
            }
          }
          setDeleteTarget(undefined);
          toast("成果已删除");
        }}
      />
    </section>
  );
}
