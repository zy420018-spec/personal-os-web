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
  Inbox,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { PageId } from "../types";
import { formatChineseDate, todayKey } from "../date";
import { useStore } from "../store";
import { Button, Field, IconButton, Modal, useToast } from "./ui";

const navItems = [
  { id: "dashboard" as const, label: "首页", icon: LayoutDashboard },
  { id: "schedule" as const, label: "日程", icon: CalendarDays },
  { id: "goals" as const, label: "目标与项目", icon: Target },
  { id: "inbox" as const, label: "收集箱", icon: Inbox },
  { id: "knowledge" as const, label: "知识库", icon: Archive },
  { id: "growth" as const, label: "成长档案", icon: TrendingUp },
  { id: "assistant" as const, label: "AI 助理", icon: Sparkles },
  { id: "focus" as const, label: "执行", icon: Clock3 },
  { id: "review" as const, label: "复盘", icon: CheckCircle2 },
  { id: "notifications" as const, label: "通知", icon: Bell },
];

const mobileNavIds: PageId[] = [
  "dashboard",
  "schedule",
  "inbox",
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
  const { data, createInboxItem, setSettings } = useStore();
  const toast = useToast();
  const [quickOpen, setQuickOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [profileName, setProfileName] = useState(data.settings.name);
  const unread = data.notifications.filter((item) => !item.read).length;
  const current = navItems.find((item) => item.id === page);

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
    setSettings({ ...data.settings, name: profileName.trim() || "你" });
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
                className={page === item.id ? "active" : ""}
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
              setProfileName(data.settings.name);
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
            <span className="topbar-section">{current?.label || "首页"}</span>
          </div>
          <div className="topbar-actions">
            <button
              className="global-search"
              onClick={() => navigate("knowledge")}
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
                setProfileName(data.settings.name);
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
              className={page === id ? "active" : ""}
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
        description="当前数据仅保存在这个浏览器中。"
        onClose={() => setSettingsOpen(false)}
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
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            maxLength={20}
          />
        </Field>
        <div className="settings-note">
          <BrainCircuit size={18} />
          <div>
            <strong>模拟 AI 说明</strong>
            <p>
              当前版本尚未接入真实模型。所有带“模拟 AI”标记的内容均由本地规则生成。
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
