import {
  Award,
  BookOpenCheck,
  BrainCircuit,
  ChevronRight,
  CircleDot,
  Edit3,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { GrowthEntry } from "../types";
import { useStore } from "../store";
import { dateAt, formatShortDate } from "../date";
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

type GrowthTab = "overview" | "ability" | "practice" | "timeline";

const emptyGrowth: Omit<GrowthEntry, "id"> = {
  title: "",
  category: "ability",
  summary: "",
  date: dateAt(0),
  skills: [],
};

const categoryLabels: Record<GrowthEntry["category"], string> = {
  ability: "能力发展",
  practice: "实践经历",
  milestone: "成长里程碑",
};

export function GrowthPage() {
  const { data, createGrowth, deleteGrowth } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<GrowthTab>("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Omit<GrowthEntry, "id">>(emptyGrowth);
  const [skillText, setSkillText] = useState("");
  const [deleteEntry, setDeleteEntry] = useState<GrowthEntry | undefined>();
  const [selected, setSelected] = useState<GrowthEntry | undefined>();
  const [formError, setFormError] = useState("");

  const abilityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    data.growth.forEach((entry) =>
      entry.skills.forEach((skill) =>
        counts.set(skill, (counts.get(skill) || 0) + 1),
      ),
    );
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.growth]);
  const abilityEntries = data.growth.filter(
    (entry) => entry.category === "ability",
  );
  const practiceEntries = data.growth.filter(
    (entry) => entry.category === "practice",
  );
  const milestoneEntries = data.growth.filter(
    (entry) => entry.category === "milestone",
  );
  const sortedEntries = [...data.growth].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  const save = () => {
    if (!form.title.trim() || !form.summary.trim()) {
      setFormError("请填写记录标题和具体变化。");
      return;
    }
    createGrowth({
      ...form,
      title: form.title.trim(),
      summary: form.summary.trim(),
      skills: skillText
        .split(/[,，、]/)
        .map((skill) => skill.trim())
        .filter(Boolean),
    });
    setModalOpen(false);
    toast("成长记录已添加");
  };

  const renderEntries = (entries: GrowthEntry[]) => (
    <div className="growth-entry-list">
      {entries.map((entry) => (
        <article className="growth-entry" key={entry.id}>
          <span className={`growth-entry-icon category-${entry.category}`}>
            {entry.category === "ability" ? (
              <TrendingUp size={17} />
            ) : entry.category === "practice" ? (
              <BookOpenCheck size={17} />
            ) : (
              <Award size={17} />
            )}
          </span>
          <button
            className="growth-entry-main"
            onClick={() => setSelected(entry)}
          >
            <span>{formatShortDate(entry.date)}</span>
            <h3>{entry.title}</h3>
            <p>{entry.summary}</p>
            <div>
              {entry.skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          </button>
          <IconButton
            icon={Trash2}
            label="删除成长记录"
            onClick={() => setDeleteEntry(entry)}
          />
          <ChevronRight size={16} className="row-arrow" />
        </article>
      ))}
      {!entries.length ? (
        <EmptyState
          icon={TrendingUp}
          title="还没有相关记录"
          description="记录一次实践、变化或重要成果。"
          action={
            <Button size="sm" onClick={() => setModalOpen(true)}>
              添加记录
            </Button>
          }
        />
      ) : null}
    </div>
  );

  return (
    <div className="page growth-page">
      <PageHeader
        eyebrow="长期积累"
        title="成长档案"
        description="看见能力如何通过一次次实践发生变化。"
        actions={
          <Button icon={Plus} onClick={() => setModalOpen(true)}>
            添加记录
          </Button>
        }
      />

      <div className="growth-toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "总览" },
            { value: "ability", label: "能力发展" },
            { value: "practice", label: "实践经历" },
            { value: "timeline", label: "成长轨迹" },
          ]}
        />
        <span className="growth-count">
          {data.growth.length} 条成长记录
        </span>
      </div>

      {tab === "overview" ? (
        <div className="growth-overview">
          <div className="growth-hero">
            <div className="growth-hero-copy">
              <span>持续积累</span>
              <h2>
                你的能力正在通过
                <br />
                真实实践变得清晰
              </h2>
              <p>
                最近记录了 {data.growth.length} 个成长节点，涉及{" "}
                {abilityCounts.length} 项能力。
              </p>
            </div>
            <div className="ability-orbit">
              <span className="orbit-center">
                <TrendingUp size={26} />
              </span>
              {abilityCounts.slice(0, 4).map(([skill, count], index) => (
                <span
                  className={`orbit-skill orbit-${index + 1}`}
                  key={skill}
                >
                  {skill}
                  <em>{count}</em>
                </span>
              ))}
            </div>
          </div>

          <div className="growth-metric-grid">
            <article>
              <span>
                <TrendingUp size={17} /> 能力发展
              </span>
              <strong>{abilityEntries.length}</strong>
              <p>有明确变化与成果支撑的记录</p>
            </article>
            <article>
              <span>
                <BookOpenCheck size={17} /> 实践经历
              </span>
              <strong>{practiceEntries.length}</strong>
              <p>从项目中沉淀出的真实经验</p>
            </article>
            <article>
              <span>
                <Award size={17} /> 重要节点
              </span>
              <strong>{milestoneEntries.length}</strong>
              <p>值得留存的阶段性成果</p>
            </article>
          </div>

          <div className="growth-main-grid">
            <section className="panel ability-profile">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">能力地图</span>
                  <h2>正在形成的能力</h2>
                </div>
                <span className="count-label">{abilityCounts.length} 项</span>
              </div>
              <div className="ability-list">
                {abilityCounts.slice(0, 6).map(([skill, count], index) => (
                  <div className="ability-row" key={skill}>
                    <span className="ability-rank">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <strong>{skill}</strong>
                      <div className="ability-track">
                        <span
                          style={{
                            width: `${Math.min(100, 35 + count * 18)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <em>{count} 次记录</em>
                  </div>
                ))}
                {!abilityCounts.length ? (
                  <p className="small-empty">记录技能标签后会生成能力地图。</p>
                ) : null}
              </div>
            </section>

            <section className="panel ai-observation">
              <div className="panel-heading compact">
                <div>
                  <SimulatedTag />
                  <h2>AI 观察</h2>
                </div>
                <BrainCircuit size={20} />
              </div>
              <div className="observation-lead">
                <Sparkles size={19} />
                <p>
                  你最近的记录集中在
                  <strong>
                    {abilityCounts
                      .slice(0, 2)
                      .map(([skill]) => skill)
                      .join("、") || "实践经验"}
                  </strong>
                  ，并通过真实项目逐步形成方法。
                </p>
              </div>
              <div className="observation-points">
                <div>
                  <CircleDot size={14} />
                  <span>把访谈中的发现写成了明确的知识观点。</span>
                </div>
                <div>
                  <CircleDot size={14} />
                  <span>复盘记录开始从“发生了什么”转向“下次怎么做”。</span>
                </div>
                <div>
                  <CircleDot size={14} />
                  <span>建议为下一次实践补充可验证的成果材料。</span>
                </div>
              </div>
              <p className="simulation-disclaimer">
                本地规则生成的模拟观察，不会自动写入档案。
              </p>
            </section>
          </div>

          <section className="panel recent-growth">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">最近发生</span>
                <h2>成长轨迹</h2>
              </div>
              <button
                className="text-action"
                onClick={() => setTab("timeline")}
              >
                查看全部 <ChevronRight size={14} />
              </button>
            </div>
            {renderEntries(sortedEntries.slice(0, 3))}
          </section>
        </div>
      ) : null}

      {tab === "ability" ? (
        <section className="growth-tab-content">
          <div className="growth-tab-intro">
            <span>能力发展</span>
            <h2>不只是“学过”，而是留下了变化的证据</h2>
            <p>每条记录都关联具体实践、成果和可继续发展的方向。</p>
          </div>
          {renderEntries(abilityEntries)}
        </section>
      ) : null}

      {tab === "practice" ? (
        <section className="growth-tab-content">
          <div className="growth-tab-intro">
            <span>实践经历</span>
            <h2>通过真实项目积累经验</h2>
            <p>记录参与过什么、解决了什么问题，以及留下了什么成果。</p>
          </div>
          {renderEntries(practiceEntries)}
        </section>
      ) : null}

      {tab === "timeline" ? (
        <section className="growth-tab-content timeline-growth">
          <div className="growth-tab-intro">
            <span>全部记录</span>
            <h2>成长轨迹</h2>
            <p>按时间回看每个重要变化和成果。</p>
          </div>
          <div className="growth-year-line">
            <span>{new Date().getFullYear()}</span>
            <i />
          </div>
          {renderEntries(sortedEntries)}
        </section>
      ) : null}

      <Modal
        open={modalOpen}
        title="添加成长记录"
        description="记录一个具体变化，以及支撑这个变化的真实经历。"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>保存记录</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="记录标题" required className="span-2">
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              placeholder="例如：第一次独立完成用户访谈"
            />
          </Field>
          <Field label="记录类型">
            <select
              value={form.category}
              onChange={(event) =>
                setForm({
                  ...form,
                  category: event.target.value as GrowthEntry["category"],
                })
              }
            >
              <option value="ability">能力发展</option>
              <option value="practice">实践经历</option>
              <option value="milestone">成长里程碑</option>
            </select>
          </Field>
          <Field label="日期">
            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
            />
          </Field>
          <Field label="具体变化" required className="span-2">
            <textarea
              rows={5}
              value={form.summary}
              onChange={(event) =>
                setForm({ ...form, summary: event.target.value })
              }
              placeholder="发生了什么？你和之前相比有什么不同？"
            />
          </Field>
          <Field label="能力标签" hint="用逗号分隔" className="span-2">
            <input
              value={skillText}
              onChange={(event) => setSkillText(event.target.value)}
              placeholder="用户研究, 结构化表达"
            />
          </Field>
          {formError ? <p className="form-error span-2">{formError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(selected)}
        title={selected?.title || "成长记录"}
        onClose={() => setSelected(undefined)}
        footer={
          <Button variant="secondary" onClick={() => setSelected(undefined)}>
            关闭
          </Button>
        }
      >
        {selected ? (
          <div className="growth-detail">
            <div>
              <span>{categoryLabels[selected.category]}</span>
              <em>{formatShortDate(selected.date)}</em>
            </div>
            <p>{selected.summary}</p>
            <div className="knowledge-tags">
              {selected.skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteEntry)}
        description={`删除“${deleteEntry?.title || ""}”后，这条成长记录将无法恢复。`}
        onCancel={() => setDeleteEntry(undefined)}
        onConfirm={() => {
          if (deleteEntry) deleteGrowth(deleteEntry.id);
          setDeleteEntry(undefined);
          toast("成长记录已删除");
        }}
      />
    </div>
  );
}
