import {
  ArrowUpRight,
  BookOpen,
  Edit3,
  ExternalLink,
  FileText,
  Library,
  Link2,
  Plus,
  Search,
  Send,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { KnowledgeItem } from "../types";
import { useStore } from "../store";
import { formatShortDate } from "../date";
import { requestAI } from "../ai";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  SimulatedTag,
  useToast,
} from "../components/ui";

const emptyKnowledge: Omit<KnowledgeItem, "id" | "createdAt"> = {
  title: "",
  summary: "",
  content: "",
  source: "",
  url: "",
  category: "个人笔记",
  type: "note",
  tags: [],
  linkedProjectId: "",
};

const typeLabel: Record<KnowledgeItem["type"], string> = {
  article: "文章",
  note: "笔记",
  book: "书籍",
  video: "视频",
  link: "链接",
};

export function KnowledgePage({ embedded = false }: { embedded?: boolean }) {
  const {
    data,
    createKnowledge,
    updateKnowledge,
    deleteKnowledge,
  } = useStore();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部");
  const [type, setType] = useState<KnowledgeItem["type"] | "all">("all");
  const [selectedId, setSelectedId] = useState(data.knowledge[0]?.id || "");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeItem | undefined>();
  const [form, setForm] =
    useState<Omit<KnowledgeItem, "id" | "createdAt">>(emptyKnowledge);
  const [tagText, setTagText] = useState("");
  const [deleteItem, setDeleteItem] = useState<KnowledgeItem | undefined>();
  const [qaOpen, setQaOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    data.knowledge.forEach((item) =>
      counts.set(item.category, (counts.get(item.category) || 0) + 1),
    );
    return ["全部", ...Array.from(counts.keys())];
  }, [data.knowledge]);
  const tags = useMemo(
    () => [...new Set(data.knowledge.flatMap((item) => item.tags))],
    [data.knowledge],
  );
  const filtered = data.knowledge.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [item.title, item.summary, item.content, ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(query);
    const matchesCategory =
      category === "全部" || item.category === category;
    const matchesType = type === "all" || item.type === type;
    return matchesSearch && matchesCategory && matchesType;
  });
  const selected =
    data.knowledge.find((item) => item.id === selectedId) || filtered[0];

  const openEditor = (item?: KnowledgeItem) => {
    setEditing(item);
    setForm(
      item
        ? {
            title: item.title,
            summary: item.summary,
            content: item.content,
            source: item.source || "",
            url: item.url || "",
            category: item.category,
            type: item.type,
            tags: item.tags,
            linkedProjectId: item.linkedProjectId || "",
          }
        : emptyKnowledge,
    );
    setTagText(item?.tags.join("，") || "");
    setFormError("");
    setEditorOpen(true);
  };

  const saveKnowledge = () => {
    if (!form.title.trim() || !form.content.trim()) {
      setFormError("请填写标题和正文内容。");
      return;
    }
    const normalized = {
      ...form,
      title: form.title.trim(),
      summary: form.summary.trim() || form.content.trim().slice(0, 80),
      content: form.content.trim(),
      source: form.source?.trim(),
      url: form.url?.trim(),
      linkedProjectId: form.linkedProjectId || undefined,
      tags: tagText
        .split(/[,，、]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    if (editing) {
      updateKnowledge({ ...editing, ...normalized });
      toast("知识资料已更新");
    } else {
      createKnowledge(normalized);
      toast("知识资料已添加");
    }
    setEditorOpen(false);
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    setQaLoading(true);
    setAnswer("");
    if (data.settings.aiEndpoint && data.settings.aiConsent) {
      try {
        const result = await requestAI({
          endpoint: data.settings.aiEndpoint,
          message: question.trim(),
          mode: "advisory",
          history: [],
          context: {
            instruction: "只根据这些知识库资料回答，并在回答中注明资料标题；没有依据时明确说没有检索到。",
            knowledge: data.knowledge,
          },
        });
        setAnswer(result.reply);
      } catch (error) {
        setAnswer(
          error instanceof Error
            ? `AI 请求失败：${error.message}`
            : "AI 请求失败，请稍后重试。",
        );
      } finally {
        setQaLoading(false);
      }
      return;
    }
    window.setTimeout(() => {
      const terms = question
        .replace(/[？?，。！!]/g, "")
        .split(/\s+/)
        .filter((term) => term.length > 1);
      const ranked = data.knowledge
        .map((item) => {
          const haystack = `${item.title} ${item.summary} ${item.content} ${item.tags.join(" ")}`;
          const score = terms.reduce(
            (sum, term) => sum + (haystack.includes(term) ? 1 : 0),
            0,
          );
          return { item, score };
        })
        .sort((a, b) => b.score - a.score);
      const matches = ranked.filter((entry) => entry.score > 0).slice(0, 2);
      const sources = (matches.length ? matches : ranked.slice(0, 2))
        .map((entry) => `《${entry.item.title}》`)
        .join("、");
      const summary =
        matches[0]?.item.summary ||
        data.knowledge[0]?.summary ||
        "当前知识库还没有足够内容回答这个问题。";
      setAnswer(
        `当前未连接或未授权真实 AI。以下是本地关键词检索结果：\n\n${summary}\n\n可继续查看：${sources}。`,
      );
      setQaLoading(false);
    }, 650);
  };

  return (
    <div className={`${embedded ? "embedded-page" : "page"} knowledge-page`}>
      {!embedded ? (
        <PageHeader
          eyebrow="个人知识"
          title="知识库"
          description="留下以后还会用到的判断、方法和来源。"
          actions={
            <>
              <Button
                variant="secondary"
                icon={Sparkles}
                onClick={() => setQaOpen(true)}
              >
                知识问答
              </Button>
              <Button icon={Plus} onClick={() => openEditor()}>
                添加资料
              </Button>
            </>
          }
        />
      ) : null}
      {embedded ? (
        <div className="embedded-actions">
          <span>知识问答与新增资料仍可直接使用</span>
          <div>
            <Button
              size="sm"
              variant="secondary"
              icon={Sparkles}
              onClick={() => setQaOpen(true)}
            >
              知识问答
            </Button>
            <Button size="sm" icon={Plus} onClick={() => openEditor()}>
              添加资料
            </Button>
          </div>
        </div>
      ) : null}

      <div className="knowledge-search">
        <Search size={19} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索标题、内容、标签…"
        />
        {search ? (
          <button onClick={() => setSearch("")}>清除</button>
        ) : (
          <kbd>⌘ K</kbd>
        )}
      </div>

      <div className="knowledge-layout">
        <aside className="knowledge-filters">
          <section>
            <span className="filter-title">分类</span>
            {categories.map((item) => (
              <button
                key={item}
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                <Library size={15} />
                {item}
                <em>
                  {item === "全部"
                    ? data.knowledge.length
                    : data.knowledge.filter((entry) => entry.category === item)
                        .length}
                </em>
              </button>
            ))}
          </section>
          <section>
            <span className="filter-title">资料类型</span>
            <button
              className={type === "all" ? "active" : ""}
              onClick={() => setType("all")}
            >
              <FileText size={15} /> 全部类型
            </button>
            {(Object.keys(typeLabel) as KnowledgeItem["type"][]).map((key) => (
              <button
                key={key}
                className={type === key ? "active" : ""}
                onClick={() => setType(key)}
              >
                {key === "link" ? <Link2 size={15} /> : <FileText size={15} />}
                {typeLabel[key]}
              </button>
            ))}
          </section>
          <section>
            <span className="filter-title">标签</span>
            <div className="tag-cloud">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSearch(tag)}
                  className="tag-button"
                >
                  <Tag size={11} /> {tag}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="knowledge-list-panel">
          <div className="knowledge-list-head">
            <span>{filtered.length} 条资料</span>
            <button onClick={() => setSearch("")}>重置筛选</button>
          </div>
          <div className="knowledge-list">
            {filtered.map((item) => {
              const project = data.projects.find(
                (entry) => entry.id === item.linkedProjectId,
              );
              return (
                <button
                  key={item.id}
                  className={`knowledge-card ${selected?.id === item.id ? "selected" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="knowledge-card-type">
                    <FileText size={15} />
                    {typeLabel[item.type]}
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <div className="knowledge-card-meta">
                    <span>{item.category}</span>
                    <i />
                    <span>{formatShortDate(item.createdAt)}</span>
                    {project ? (
                      <>
                        <i />
                        <span>{project.title}</span>
                      </>
                    ) : null}
                  </div>
                </button>
              );
            })}
            {!filtered.length ? (
              <EmptyState
                icon={BookOpen}
                title="没有找到资料"
                description="换个关键词，或者添加一条新的知识记录。"
                action={
                  <Button size="sm" onClick={() => openEditor()}>
                    添加资料
                  </Button>
                }
              />
            ) : null}
          </div>
        </section>

        <aside className="knowledge-detail-panel">
          {selected ? (
            <article className="knowledge-detail">
              <div className="knowledge-detail-top">
                <span className="type-label">
                  {typeLabel[selected.type]}
                </span>
                <div className="row-actions">
                  <IconButton
                    icon={Edit3}
                    label="编辑资料"
                    onClick={() => openEditor(selected)}
                  />
                  <IconButton
                    icon={Trash2}
                    label="删除资料"
                    onClick={() => setDeleteItem(selected)}
                  />
                </div>
              </div>
              <h2>{selected.title}</h2>
              <p className="knowledge-summary">{selected.summary}</p>
              <div className="knowledge-tags">
                {selected.tags.map((tag) => (
                  <span key={tag}>
                    <Tag size={11} /> {tag}
                  </span>
                ))}
              </div>
              <div className="article-body">
                {selected.content.split("\n").map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
              <div className="source-block">
                <span>来源</span>
                <strong>{selected.source || "个人记录"}</strong>
                {selected.url ? (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看原文 <ExternalLink size={13} />
                  </a>
                ) : null}
              </div>
              {selected.linkedProjectId ? (
                <div className="linked-project">
                  <span>关联项目</span>
                  <strong>
                    {
                      data.projects.find(
                        (project) => project.id === selected.linkedProjectId,
                      )?.title
                    }
                  </strong>
                  <ArrowUpRight size={15} />
                </div>
              ) : null}
            </article>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="选择一条资料"
              description="完整内容、来源和关联项目会显示在这里。"
            />
          )}
        </aside>
      </div>

      <Modal
        open={editorOpen}
        title={editing ? "编辑资料" : "添加资料"}
        description="可以保存个人笔记、文章摘要或外部链接。"
        onClose={() => setEditorOpen(false)}
        width="680px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>
              取消
            </Button>
            <Button onClick={saveKnowledge}>
              {editing ? "保存修改" : "添加资料"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="标题" required className="span-2">
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              placeholder="这条资料最值得记住的是什么？"
            />
          </Field>
          <Field label="分类">
            <input
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
            />
          </Field>
          <Field label="资料类型">
            <select
              value={form.type}
              onChange={(event) =>
                setForm({
                  ...form,
                  type: event.target.value as KnowledgeItem["type"],
                })
              }
            >
              {(Object.keys(typeLabel) as KnowledgeItem["type"][]).map(
                (key) => (
                  <option key={key} value={key}>
                    {typeLabel[key]}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="摘要" className="span-2">
            <textarea
              rows={2}
              value={form.summary}
              onChange={(event) =>
                setForm({ ...form, summary: event.target.value })
              }
              placeholder="用一两句话说明核心观点"
            />
          </Field>
          <Field label="正文" required className="span-2">
            <textarea
              rows={7}
              value={form.content}
              onChange={(event) =>
                setForm({ ...form, content: event.target.value })
              }
            />
          </Field>
          <Field label="来源">
            <input
              value={form.source || ""}
              onChange={(event) =>
                setForm({ ...form, source: event.target.value })
              }
              placeholder="文章、书籍或个人记录"
            />
          </Field>
          <Field label="原文链接">
            <input
              type="url"
              value={form.url || ""}
              onChange={(event) =>
                setForm({ ...form, url: event.target.value })
              }
              placeholder="https://"
            />
          </Field>
          <Field label="关联项目">
            <select
              value={form.linkedProjectId || ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  linkedProjectId: event.target.value,
                })
              }
            >
              <option value="">不关联</option>
              {data.projects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="标签" hint="用逗号分隔">
            <input
              value={tagText}
              onChange={(event) => setTagText(event.target.value)}
              placeholder="用户研究, 复盘"
            />
          </Field>
          {formError ? <p className="form-error span-2">{formError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={qaOpen}
        title="知识库问答"
        description="从当前本地资料中检索相关片段。"
        onClose={() => setQaOpen(false)}
        width="680px"
        footer={
          <Button variant="secondary" onClick={() => setQaOpen(false)}>
            关闭
          </Button>
        }
      >
        <div className="qa-box">
          {data.settings.aiEndpoint && data.settings.aiConsent ? (
            <span className="ai-connection connected">
              真实 AI 已配置
            </span>
          ) : (
            <SimulatedTag label="本地检索 · 非 AI" />
          )}
          <textarea
            rows={3}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                askQuestion();
              }
            }}
            placeholder="例如：我的产品笔记里，关于行动闭环有哪些观点？"
          />
          <Button
            icon={Send}
            disabled={!question.trim() || qaLoading}
            onClick={askQuestion}
          >
            {qaLoading ? "检索中…" : "提问"}
          </Button>
        </div>
        {answer ? (
          <div className="qa-answer">
            <div>
              <Sparkles size={17} />
              <strong>
                {data.settings.aiEndpoint && data.settings.aiConsent
                  ? "真实 AI 回答"
                  : "本地检索结果"}
              </strong>
            </div>
            {answer.split("\n").map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteItem)}
        description={`删除“${deleteItem?.title || ""}”后将无法在这个浏览器中恢复。`}
        onCancel={() => setDeleteItem(undefined)}
        onConfirm={() => {
          if (deleteItem) deleteKnowledge(deleteItem.id);
          setDeleteItem(undefined);
          toast("资料已删除");
        }}
      />
    </div>
  );
}
