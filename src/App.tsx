import { useEffect, useState } from "react";
import { StoreProvider } from "./store";
import type { PageId } from "./types";
import { AppShell } from "./components/AppShell";
import { ToastProvider } from "./components/ui";
import { DashboardPage } from "./pages/Dashboard";
import { SchedulePage } from "./pages/Schedule";
import { GoalsPage } from "./pages/Goals";
import { InboxPage } from "./pages/Inbox";
import { KnowledgePage } from "./pages/Knowledge";
import { GrowthPage } from "./pages/Growth";
import { AssistantPage } from "./pages/Assistant";
import { FocusPage } from "./pages/Focus";
import { ReviewPage } from "./pages/Review";
import { NotificationsPage } from "./pages/Notifications";

const validPages: PageId[] = [
  "dashboard",
  "schedule",
  "goals",
  "inbox",
  "knowledge",
  "growth",
  "assistant",
  "focus",
  "review",
  "notifications",
];

const pageFromHash = (): PageId => {
  const value = window.location.hash.replace("#/", "") as PageId;
  return validPages.includes(value) ? value : "dashboard";
};

export default function App() {
  const [page, setPage] = useState<PageId>(pageFromHash);

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = (target: PageId) => {
    window.location.hash = `/${target}`;
    setPage(target);
  };

  return (
    <StoreProvider>
      <ToastProvider>
        <AppShell page={page} onNavigate={navigate}>
          {page === "dashboard" ? (
            <DashboardPage onNavigate={navigate} />
          ) : null}
          {page === "schedule" ? <SchedulePage /> : null}
          {page === "goals" ? <GoalsPage onNavigate={navigate} /> : null}
          {page === "inbox" ? (
            <InboxPage onNavigate={navigate} />
          ) : null}
          {page === "knowledge" ? <KnowledgePage /> : null}
          {page === "growth" ? <GrowthPage /> : null}
          {page === "assistant" ? <AssistantPage /> : null}
          {page === "focus" ? <FocusPage onNavigate={navigate} /> : null}
          {page === "review" ? <ReviewPage /> : null}
          {page === "notifications" ? (
            <NotificationsPage onNavigate={navigate} />
          ) : null}
        </AppShell>
      </ToastProvider>
    </StoreProvider>
  );
}
