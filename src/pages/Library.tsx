import { Archive, Inbox, Sparkles } from "lucide-react";
import { useState } from "react";
import type { PageId } from "../types";
import { PageHeader, Tabs } from "../components/ui";
import { InboxPage } from "./Inbox";
import { KnowledgePage } from "./Knowledge";

type LibraryTab = "inbox" | "knowledge";

export function LibraryPage({
  initialTab = "inbox",
  onNavigate,
}: {
  initialTab?: LibraryTab;
  onNavigate: (page: PageId) => void;
}) {
  const [tab, setTab] = useState<LibraryTab>(initialTab);

  return (
    <div className="page library-page">
      <PageHeader
        eyebrow="信息与知识"
        title="信息库"
        description="先收集，再整理，最后沉淀为可以再次使用的知识。"
        actions={
          <span className="library-ai-state">
            <Sparkles size={14} />
            真实 AI 整理需配置服务
          </span>
        }
      />
      <div className="library-tabs">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "inbox", label: "快速收集" },
            { value: "knowledge", label: "知识库" },
          ]}
        />
        <span>
          {tab === "inbox" ? (
            <>
              <Inbox size={14} /> 尚未整理的信息
            </>
          ) : (
            <>
              <Archive size={14} /> 已沉淀的资料
            </>
          )}
        </span>
      </div>
      {tab === "inbox" ? (
        <InboxPage embedded onNavigate={onNavigate} />
      ) : (
        <KnowledgePage embedded />
      )}
    </div>
  );
}
