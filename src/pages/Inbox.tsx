import {
  Archive,
  ArrowRight,
  BookOpen,
  Check,
  FolderPlus,
  Inbox,
  Lightbulb,
  ListTodo,
  MoreHorizontal,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { InboxCategory, InboxItem, PageId } from "../types";
import { useStore } from "../store";
import { formatDateTime, todayKey } from "../date";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  SimulatedTag,
  Tabs,
  useToast,
} from "../components/ui";

type FilterMode = "all" | "pending" | "archived";

const categoryMeta: Record<
  InboxCategory,
  { label: string; icon: typeof Lightbulb; hint: string }
> = {
  idea: { label: "想法", icon: Lightbulb, hint: "先保留，之后可能发展成方向" },
  task: { label: "临时任务", icon: ListTodo, hint: "有明确下一步，适合尽快安排" },
  project: { label: "项目方向", icon: FolderPlus, hint: "需要多个步骤才能完成" },
  goal: { label: "目标", icon: Target, hint: "想达成的长期结果或发展方向" },
  knowledge: { label: "知识资料", icon: BookOpen, hint: "值得沉淀和再次检索" },
};

const localClassify = (content: string): InboxCategory => {
  if (/(预约|提醒|完成|提交|联系|购买|整理|回复|发送)/.test(content))
    return "task";
  if (/(项目|开发|上线|发布|计划|方案|研究)/.test(content)) return "project";
  if (/(文章|资料|读到|学习|观点|方法|知识|笔记)/.test(content))
    return "knowledge";
  return "idea";
};

export function InboxPage({
  onNavigate,
}: {
  onNavigate: (page: PageId) => void;
}) {
  const {
    data,
    createInboxItem,
    updateInboxItem,
    deleteInboxItem,
    createTask,
    createProject,
    createGoal,
    createKnowledge,
  } = useStore();
  const toast = useToast();
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<FilterMode>("pending");
  const [categoryFilter, setCategoryFilter] = useState<
    InboxCategory | "all"
  >("all");
  const [selected, setSelected] = useState<InboxItem | undefined>();
  const [convertItem, setConvertItem] = useState<InboxItem | undefined>();
  const [conversionType, setConversionType] =
    useState<InboxCategory>("task");
  const [conversionTitle, setConversionTitle] = useState("");
  const [conversionDetail, setConversionDetail] = useState("");
  const [deadline, setDeadline] = useState(todayKey());
  const [estimate, setEstimate] = useState(30);
  const [deleteItem, setDeleteItem] = useState<InboxItem | undefined>();
  const [formError, setFormError] = useState("");

  const filteredItems = useMemo(() => {
    return data.inbox.filter((item) => {
      if (filter === "pending" && item.archived) return false;
      if (filter === "archived" && !item.archived) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter)
        return false;
      return true;
    });
  }, [data.inbox, filter, categoryFilter]);

  const saveCapture = () => {
    if (!text.trim()) return;
    const category = localClassify(text);
    createInboxItem({
      content: text.trim(),
      category,
      archived: false,
    });
    setText("");
    toast(`已保存，本地规则建议归为“${categoryMeta[category].label}”`);
  };

  const openConvert = (item: InboxItem, type = item.category) => {
    setConvertItem(item);
    setConversionType(type);
    setConversionTitle(item.content.slice(0, 42));
    setConversionDetail(item.content);
    setDeadline(todayKey());
    setEstimate(30);
    setFormError("");
  };

  const convert = () => {
    if (!convertItem || !conversionTitle.trim()) {
      setFormError("请填写标题。");
      return;
    }
    const title = conversionTitle.trim();
    if (conversionType === "task") {
      createTask({
        title,
        description: conversionDetail.trim(),
        status: "todo",
        priority: "medium",
        deadline,
        estimate,
      });
      toast("已转换为任务，原想法仍保留在收集箱");
    }
    if (conversionType === "project") {
      createProject({
        title,
        outcome: conversionDetail.trim() || title,
        deadline,
        mode: "simple",
      });
      toast("已转换为项目，原想法仍保留在收集箱");
    }
    if (conversionType === "goal") {
      createGoal({
        title,
        outcome: conversionDetail.trim() || title,
        description: conversionDetail.trim(),
        deadline,
      });
      toast("已转换为目标，原想法仍保留在收集箱");
    }
    if (conversionType === "knowledge") {
      createKnowledge({
        title,
        summary: conversionDetail.trim().slice(0, 90),
        content: conversionDetail.trim(),
        source: "收集箱",
        category: "个人想法",
        type: "note",
        tags: ["收集箱"],
      });
      toast("已整理为知识资料，原想法仍保留在收集箱");
    }
    updateInboxItem({
      ...convertItem,
      archived: true,
      convertedTo: conversionType,
    });
    setConvertItem(undefined);
  };

  return (
    <div className="page inbox-page">
      <PageHeader
        eyebrow="快速记录"
        title="收集箱"
        description="记录时不必打断自己，之后再决定它要去哪里。"
      />

      <section className="capture-panel">
        <div className="capture-icon">
          <Inbox size={22} />
        </div>
        <div className="capture-main">
          <textarea
            rows={2}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                saveCapture();
              }
            }}
            placeholder="写下想法、临时事项或值得留下的资料…"
          />
          <div className="capture-footer">
            <span>
              <Sparkles size={14} /> 保存时使用本地规则给出分类建议
            </span>
            <Button onClick={saveCapture} disabled={!text.trim()}>
              保存到收集箱
            </Button>
          </div>
        </div>
      </section>

      <div className="inbox-toolbar">
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            {
              value: "all",
              label: "全部",
              count: data.inbox.length,
            },
            {
              value: "pending",
              label: "待整理",
              count: data.inbox.filter((item) => !item.archived).length,
            },
            {
              value: "archived",
              label: "已归档",
              count: data.inbox.filter((item) => item.archived).length,
            },
          ]}
        />
        <div className="category-pills">
          <button
            className={categoryFilter === "all" ? "active" : ""}
            onClick={() => setCategoryFilter("all")}
          >
            所有类型
          </button>
          {(
            Object.entries(categoryMeta) as [
              InboxCategory,
              (typeof categoryMeta)[InboxCategory],
            ][]
          ).map(([key, meta]) => (
            <button
              key={key}
              className={categoryFilter === key ? "active" : ""}
              onClick={() => setCategoryFilter(key)}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      <section className="inbox-list">
        {filteredItems.map((item) => {
          const meta = categoryMeta[item.category];
          const Icon = meta.icon;
          return (
            <article
              className={`inbox-item ${item.archived ? "archived" : ""}`}
              key={item.id}
            >
              <button
                className={`inbox-type type-${item.category}`}
                onClick={() => setSelected(item)}
                aria-label={`查看${meta.label}`}
              >
                <Icon size={18} />
              </button>
              <div className="inbox-item-main">
                <button
                  className="inbox-item-content"
                  onClick={() => setSelected(item)}
                >
                  {item.content}
                </button>
                <div className="inbox-item-meta">
                  <span>{formatDateTime(item.createdAt)}</span>
                  <i />
                  <span>{meta.label}</span>
                  {item.archived ? (
                    <>
                      <i />
                      <span className="converted-label">
                        <Check size={12} /> 已整理
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              {!item.archived ? (
                <div className="inbox-suggestion">
                  <SimulatedTag label="建议" />
                  <span>{meta.hint}</span>
                </div>
              ) : null}
              <div className="inbox-actions">
                {!item.archived ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openConvert(item)}
                  >
                    整理 <ArrowRight size={14} />
                  </Button>
                ) : null}
                <IconButton
                  icon={MoreHorizontal}
                  label="查看详情"
                  onClick={() => setSelected(item)}
                />
                <IconButton
                  icon={Trash2}
                  label="删除"
                  onClick={() => setDeleteItem(item)}
                />
              </div>
            </article>
          );
        })}
        {!filteredItems.length ? (
          <EmptyState
            icon={Inbox}
            title={filter === "pending" ? "收集箱已经清空" : "这里还没有内容"}
            description={
              filter === "pending"
                ? "新的想法会先安静地待在这里。"
                : "记录一条内容后再回来查看。"
            }
          />
        ) : null}
      </section>

      <Modal
        open={Boolean(selected)}
        title="收集内容"
        onClose={() => setSelected(undefined)}
        footer={
          <>
            {selected && !selected.archived ? (
              <Button
                icon={Sparkles}
                onClick={() => {
                  const current = selected;
                  setSelected(undefined);
                  openConvert(current);
                }}
              >
                整理这条内容
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setSelected(undefined)}>
                关闭
              </Button>
            )}
          </>
        }
      >
        {selected ? (
          <div className="inbox-detail">
            <p>{selected.content}</p>
            <div>
              <span>{formatDateTime(selected.createdAt)}</span>
              <select
                value={selected.category}
                onChange={(event) => {
                  const updated = {
                    ...selected,
                    category: event.target.value as InboxCategory,
                  };
                  updateInboxItem(updated);
                  setSelected(updated);
                  toast("分类已调整");
                }}
              >
                {Object.entries(categoryMeta).map(([key, meta]) => (
                  <option value={key} key={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="sm"
                icon={Archive}
                onClick={() => {
                  const updated = { ...selected, archived: !selected.archived };
                  updateInboxItem(updated);
                  setSelected(updated);
                  toast(updated.archived ? "已归档" : "已恢复到待整理");
                }}
              >
                {selected.archived ? "恢复" : "归档"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(convertItem)}
        title="整理这条记录"
        description="原始内容会保留，转换结果创建后会自动归档。"
        onClose={() => setConvertItem(undefined)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConvertItem(undefined)}
            >
              取消
            </Button>
            <Button onClick={convert}>确认转换</Button>
          </>
        }
      >
        <div className="conversion-types">
          {(Object.keys(categoryMeta) as InboxCategory[]).map((key) => {
            const meta = categoryMeta[key];
            const Icon = meta.icon;
            return (
              <button
                className={conversionType === key ? "active" : ""}
                key={key}
                onClick={() => setConversionType(key)}
              >
                <Icon size={18} />
                <span>{meta.label}</span>
                {conversionType === key ? <Check size={14} /> : null}
              </button>
            );
          })}
        </div>
        <div className="form-grid">
          <Field label="标题" required className="span-2">
            <input
              value={conversionTitle}
              onChange={(event) => setConversionTitle(event.target.value)}
            />
          </Field>
          <Field
            label={
              conversionType === "task"
                ? "任务说明"
                : conversionType === "project"
                  ? "预期成果"
                  : conversionType === "goal"
                    ? "目标成果"
                    : "摘要"
            }
            className="span-2"
          >
            <textarea
              rows={3}
              value={conversionDetail}
              onChange={(event) => setConversionDetail(event.target.value)}
            />
          </Field>
          {conversionType !== "knowledge" ? (
            <Field label="目标日期">
              <input
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </Field>
          ) : null}
          {conversionType === "task" ? (
            <Field label="预计耗时" hint="分钟">
              <input
                type="number"
                min={5}
                step={5}
                value={estimate}
                onChange={(event) => setEstimate(Number(event.target.value))}
              />
            </Field>
          ) : null}
          {formError ? <p className="form-error span-2">{formError}</p> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteItem)}
        description="这条收集记录将被永久删除，已经转换出的对象不会受影响。"
        onCancel={() => setDeleteItem(undefined)}
        onConfirm={() => {
          if (deleteItem) deleteInboxItem(deleteItem.id);
          setDeleteItem(undefined);
          setSelected(undefined);
          toast("收集记录已删除");
        }}
      />
    </div>
  );
}
