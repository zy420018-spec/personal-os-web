import {
  Archive,
  Bell,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Command,
  Compass,
  Database,
  Download,
  Inbox,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { PageId } from "../types";
import { formatChineseDate, todayKey } from "../date";
import { useStore } from "../store";
import { Button, Field, IconButton, Modal, useToast } from "./ui";

const navItems = [
  { id: "dashboard" as const, label: "首页", icon: LayoutDashboard },
  { id: "planning" as const, label: "规划", icon: CalendarDays },
  { id: "goals" as const, label: "目标与项目", icon: Target },
  { id: "library" as const, label: "信息库", icon: Archive },
  { id: "growth" as const, label: "成长档案", icon: TrendingUp },
  { id: "assistant" as const, label: "AI 助理", icon: Sparkles },
  { id: "review" as const, label: "复盘", icon: CheckCircle2 },
  { id: "notifications" as const, label: "通知", icon: Bell },
];

const mobileNavIds: PageId[] = [
  "dashboard",
  "planning",
  "library",
  "assistant",
];

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export function AppShell({
  page,
  onNavigate,
  children,
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}) {
  const {
    data,
    createInboxItem,
    setSettings,
    importData,
  } = useStore();
  const toast = useToast();
  const [quickOpen, setQuickOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [settingsDraft, setSettingsDraft] = useState(data.settings);
  const unread = data.notifications.filter((item) => !item.read).length;
  const legacyNavMap: Partial<Record<PageId, PageId>> = {
    schedule: "planning",
    inbox: "library",
    knowledge: "library",
  };
  const current =
    navItems.find((item) => item.id === page) ||
    navItems.find((item) => item.id === legacyNavMap[page]);
  const activePage = legacyNavMap[page] || page;
  const directPageLabel = page === "focus" ? "执行" : "首页";

  const navigate = (target: PageId) => {
    onNavigate(target);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveQuickCapture = () => {
    if (!quickText.trim()) return;
    createInboxItem({
      content: quickText.trim(),
      category: "idea",
      archived: false,
    });
    setQuickText("");
    setQuickOpen(false);
    toast("已保存到收集箱");
  };

  const saveSettings = () => {
    setSettings({
      ...data.settings,
      ...settingsDraft,
      name: settingsDraft.name.trim() || "你",
      aiEndpoint: settingsDraft.aiEndpoint.trim(),
    });
    setSettingsOpen(false);
    toast("个人设置已保存");
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <BrandMark />
          <div>
            <strong>PersonalOS</strong>
            <span>行动工作台</span>
          </div>
          <button
            className="sidebar-close"
            onClick={() => setMobileMenu(false)}
            aria-label="关闭导航"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="main-nav" aria-label="主导航">
          <span className="nav-kicker">工作空间</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activePage === item.id ? "active" : ""}
                onClick={() => navigate(item.id)}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.id === "notifications" && unread ? (
                  <em>{unread}</em>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button
            className="assistant-cta"
            onClick={() => navigate("assistant")}
          >
            <span className="assistant-orb">
              <Sparkles size={17} />
            </span>
            <span>
              <strong>和 AI 一起思考</strong>
              <small>基于当前工作台上下文</small>
            </span>
            <ChevronRight size={16} />
          </button>
          <button
            className="profile-row"
            onClick={() => {
              setSettingsDraft(data.settings);
              setSettingsOpen(true);
            }}
          >
            <span className="avatar">
              {data.settings.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{data.settings.name}</strong>
              <small>本地工作空间</small>
            </span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>

      {mobileMenu ? (
        <button
          className="mobile-scrim"
          aria-label="关闭导航"
          onClick={() => setMobileMenu(false)}
        />
      ) : null}

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              onClick={() => setMobileMenu(true)}
              aria-label="打开导航"
            >
              <Menu size={20} />
            </button>
            <span className="topbar-date">{formatChineseDate()}</span>
            <span className="topbar-separator">·</span>
            <span className="topbar-section">
              {current?.label || directPageLabel}
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="global-search"
              onClick={() => navigate("library")}
            >
              <Search size={16} />
              <span>搜索知识库</span>
              <kbd>
                <Command size={11} /> K
              </kbd>
            </button>
            <Button
              size="sm"
              icon={Plus}
              onClick={() => setQuickOpen(true)}
            >
              快速收集
            </Button>
            <button
              className="topbar-icon"
              aria-label={`通知，${unread} 条未读`}
              title="通知"
              onClick={() => navigate("notifications")}
            >
              <Bell size={18} />
              {unread ? <span>{unread}</span> : null}
            </button>
            <button
              className="topbar-avatar"
              onClick={() => {
                setSettingsDraft(data.settings);
                setSettingsOpen(true);
              }}
              aria-label="打开个人设置"
            >
              {data.settings.name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="移动端导航">
        {mobileNavIds.map((id) => {
          const item = navItems.find((nav) => nav.id === id)!;
          const Icon = item.icon;
          return (
            <button
              key={id}
              className={activePage === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button onClick={() => setMobileMenu(true)}>
          <Menu size={20} />
          <span>更多</span>
        </button>
      </nav>

      <Modal
        open={quickOpen}
        title="快速收集"
        description="先记下来，不必现在分类。"
        onClose={() => setQuickOpen(false)}
        footer={
          <>
            <span className="modal-shortcut">Ctrl / ⌘ + Enter 保存</span>
            <Button
              variant="secondary"
              onClick={() => {
                setQuickOpen(false);
                navigate("inbox");
              }}
            >
              打开收集箱
            </Button>
            <Button
              onClick={saveQuickCapture}
              disabled={!quickText.trim()}
            >
              保存
            </Button>
          </>
        }
      >
        <textarea
          autoFocus
          className="quick-capture-input"
          rows={5}
          value={quickText}
          onChange={(event) => setQuickText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              saveQuickCapture();
            }
          }}
          placeholder="此刻想到了什么？"
        />
      </Modal>

      <Modal
        open={settingsOpen}
        title="个人设置"
        description="数据默认保存在这个浏览器中；AI 密钥只能配置在服务端。"
        onClose={() => setSettingsOpen(false)}
        width="680px"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setSettingsOpen(false)}
            >
              取消
            </Button>
            <Button onClick={saveSettings}>保存设置</Button>
          </>
        }
      >
        <div className="settings-profile">
          <span className="avatar large">
            {data.settings.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <CircleUserRound size={18} />
            <p>本地个人空间</p>
          </div>
        </div>
        <Field label="显示名称">
          <input
            value={settingsDraft.name}
            onChange={(event) =>
              setSettingsDraft({
                ...settingsDraft,
                name: event.target.value,
              })
            }
            maxLength={20}
          />
        </Field>

        <div className="settings-section">
          <h3>课程与可用时间</h3>
          <div className="form-grid">
            <Field label="学期开始日期">
              <input
                type="date"
                value={settingsDraft.semesterStart}
                onChange={(event) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    semesterStart: event.target.value,
                  })
                }
              />
            </Field>
            <Field label="学期总周数">
              <input
                type="number"
                min={1}
                max={60}
                value={settingsDraft.totalWeeks}
                onChange={(event) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    totalWeeks: Number(event.target.value),
                  })
                }
              />
            </Field>
            <Field label="每日规划开始">
              <input
                type="time"
                value={settingsDraft.dayStart}
                onChange={(event) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    dayStart: event.target.value,
                  })
                }
              />
            </Field>
            <Field label="每日规划结束">
              <input
                type="time"
                value={settingsDraft.dayEnd}
                onChange={(event) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    dayEnd: event.target.value,
                  })
                }
              />
            </Field>
          </div>
        </div>

        <div className="settings-section">
          <h3>真实 AI 服务</h3>
          <Field
            label="服务端代理地址"
            hint="例如 https://your-api.example.com/api/ai"
          >
            <input
              type="url"
              value={settingsDraft.aiEndpoint}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  aiEndpoint: event.target.value,
                })
              }
              placeholder="留空表示尚未配置真实 AI"
            />
          </Field>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settingsDraft.aiConsent}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  aiConsent: event.target.checked,
                })
              }
            />
            <span>
              <strong>授权发送工作台上下文</strong>
              <small>
                包含目标、项目、任务、课程、日程、执行、成果、信息库、复盘和成长记录。
              </small>
            </span>
          </label>
        </div>

        <div className="settings-note">
          <BrainCircuit size={18} />
          <div>
            <strong>安全边界</strong>
            <p>
              前端不会保存 API Key。GitHub Pages 只提供静态页面，真实 AI
              必须通过另行部署的服务端代理访问模型。
            </p>
          </div>
        </div>

        <div className="settings-section">
          <h3>本地数据备份</h3>
          <div className="settings-data-actions">
            <Button
              variant="secondary"
              icon={Download}
              onClick={() => {
                const content = JSON.stringify(data, null, 2);
                const blob = new Blob([content], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `personal-os-backup-${todayKey()}.json`;
                anchor.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                toast("工作台数据已导出");
              }}
            >
              导出 JSON
            </Button>
            <label className="button button-secondary button-md settings-upload">
              <Upload size={16} />
              导入备份
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    const parsed = JSON.parse(await file.text());
                    if (!parsed || !Array.isArray(parsed.tasks)) {
                      throw new Error("文件中没有有效的 PersonalOS 数据。");
                    }
                    importData(parsed);
                    setSettingsOpen(false);
                    toast("数据已导入；旧数据会先保留为自动备份");
                  } catch (importError) {
                    toast(
                      importError instanceof Error
                        ? importError.message
                        : "导入失败",
                    );
                  }
                }}
              />
            </label>
            <span>
              <Database size={14} />
              JSON 包含结构化数据，不包含 IndexedDB 中的文件二进制。
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
