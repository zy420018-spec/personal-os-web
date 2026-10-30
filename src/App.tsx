import { useEffect, useState } from "react";
import { StoreProvider } from "./store";
import type { PageId } from "./types";
import { AppShell } from "./components/AppShell";
import { ToastProvider } from "./components/ui";
import { DashboardPage } from "./pages/Dashboard";
import { GoalsPage } from "./pages/Goals";
import { GrowthPage } from "./pages/Growth";
import { AssistantPage } from "./pages/Assistant";
import { FocusPage } from "./pages/Focus";
import { ReviewPage } from "./pages/Review";
import { NotificationsPage } from "./pages/Notifications";
import { PlanningPage } from "./pages/Planning";
import { LibraryPage } from "./pages/Library";

const validPages: PageId[] = [
  "dashboard",
  "planning",
  "library",
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
          {page === "planning" || page === "schedule" ? (
            <PlanningPage onNavigate={navigate} />
          ) : null}
          {page === "goals" ? <GoalsPage onNavigate={navigate} /> : null}
          {page === "library" || page === "inbox" ? (
            <LibraryPage initialTab="inbox" onNavigate={navigate} />
          ) : null}
          {page === "knowledge" ? (
            <LibraryPage initialTab="knowledge" onNavigate={navigate} />
          ) : null}
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
