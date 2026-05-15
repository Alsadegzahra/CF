import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { usePreferences } from "./context/PreferencesContext";
import type { TabId } from "./types";
import { LOGO_SRC } from "./brand";
import { resolveCourtLogoUrl } from "./lib/courtLogoStorage";
import { useDashboardData } from "./hooks/useDashboardData";
import { useSearchParamsState } from "./hooks/useSearchParamsState";
import { AppShell } from "./components/layout/AppShell";
import { AppTopBar } from "./components/auth/AppTopBar";
import { LanguageSelect } from "./components/onboarding/LanguageSelect";
import { MatchPicker } from "./components/MatchPicker";
import { RecentMatches } from "./components/RecentMatches";
import { FriendsModal } from "./components/social/FriendsModal";
import { SavedMatchesModal } from "./components/social/SavedMatchesModal";
import { FeedModal } from "./components/social/FeedModal";
import { ProfileModal } from "./components/social/ProfileModal";
import { UsernameSetupModal } from "./components/onboarding/UsernameSetupModal";
import { AnalysisView } from "./components/tabs/AnalysisView";
import { ReplayView } from "./components/tabs/ReplayView";
import { SummaryView } from "./components/tabs/SummaryView";
import { DashboardLoadingSkeleton } from "./components/ui/DashboardLoadingSkeleton";
import { ErrorState } from "./components/ui/ErrorState";

type SearchParamsState = ReturnType<typeof useSearchParamsState>;

export default function App() {
  const search = useSearchParamsState();
  const { user, needsProfileSetup } = useAuth();
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [savedMatchesOpen, setSavedMatchesOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      {needsProfileSetup ? <UsernameSetupModal /> : null}
      <AppMain
        search={search}
        onOpenFriends={() => setFriendsOpen(true)}
        onOpenSavedMatches={() => setSavedMatchesOpen(true)}
        onOpenFeed={() => setFeedOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
      />
      <FriendsModal open={friendsOpen} onClose={() => setFriendsOpen(false)} />
      <SavedMatchesModal
        open={savedMatchesOpen}
        onClose={() => setSavedMatchesOpen(false)}
        onOpenMatch={(m, c) => { search.setMatchParams(m, c); setSavedMatchesOpen(false); }}
      />
      <FeedModal
        open={feedOpen}
        onClose={() => setFeedOpen(false)}
        onOpenMatch={(m, c) => { search.setMatchParams(m, c); setFeedOpen(false); }}
      />
      {user ? (
        <ProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onOpenMatch={(m, c) => { search.setMatchParams(m, c); setProfileOpen(false); }}
        />
      ) : null}
    </>
  );
}

type AppMainProps = {
  search: SearchParamsState;
  onOpenFriends: () => void;
  onOpenSavedMatches: () => void;
  onOpenFeed: () => void;
  onOpenProfile: () => void;
};

function AppMain({ search, onOpenFriends, onOpenSavedMatches, onOpenFeed, onOpenProfile }: AppMainProps) {
  const { user } = useAuth();
  const { t, languageGateDone } = usePreferences();
  const { params, setMatchParams, clearMatchParams, openDemoMatch } = search;
  const matchId = params.get("match_id")?.trim() || "";
  const courtId = params.get("court_id")?.trim() || "";

  const [tab, setTab] = useState<TabId>("summary");
  const state = useDashboardData(matchId || null, courtId || null);

  const shellUser = user ? { onOpenFriends, onOpenSavedMatches, onOpenFeed, onOpenProfile } : {};

  const accountSaveEnabled =
    Boolean(user) && state.status === "ok" && state.data.matchId === matchId.trim();

  const reportCourtLogo =
    state.status === "ok" && state.data.matchId === matchId.trim() ? state.data.courtLogoUrl : undefined;
  const shellCourtLogo = resolveCourtLogoUrl(courtId, reportCourtLogo);

  if (!languageGateDone) {
    return <LanguageSelect />;
  }

  if (!matchId) {
    return (
      <div className="min-h-screen bg-cf-canvas">
        <header className="sticky top-0 z-40 flex justify-end border-b border-cf-line/80 bg-white/95 px-5 py-2.5 backdrop-blur-md">
          <AppTopBar
            onOpenFriends={user ? onOpenFriends : undefined}
            onOpenSavedMatches={user ? onOpenSavedMatches : undefined}
            onOpenFeed={user ? onOpenFeed : undefined}
            onOpenProfile={user ? onOpenProfile : undefined}
          />
        </header>
        <div className="mx-auto max-w-[1120px] px-5 pt-6">
          <img
            src={LOGO_SRC}
            alt="CourtFlow"
            className="h-11 w-auto max-w-[min(240px,58vw)] object-contain"
            decoding="async"
          />
        </div>
        <MatchPicker onSubmit={(m, c) => setMatchParams(m, c)} onTryDemo={openDemoMatch} />
        {user ? <RecentMatches onOpenMatch={(m, c) => setMatchParams(m, c)} /> : null}
      </div>
    );
  }

  const shellCourt = state.status === "ok" ? state.data.courtId : courtId || "—";
  const shellMatch = state.status === "ok" ? state.data.matchId : matchId;

  if (matchId && state.status !== "ok" && state.status !== "error") {
    return (
      <AppShell
        {...shellUser}
        accountSaveEnabled={accountSaveEnabled}
        matchId={shellMatch}
        courtId={shellCourt}
        courtLogoUrl={shellCourtLogo}
        tab={tab}
        onTab={setTab}
        onBack={clearMatchParams}
      >
        <div className="space-y-4">
          <p className="text-center text-sm font-medium text-cf-muted">{t("loading")}</p>
          <DashboardLoadingSkeleton />
        </div>
      </AppShell>
    );
  }

  if (state.status === "ok" && state.data.matchId !== matchId) {
    return (
      <AppShell
        {...shellUser}
        accountSaveEnabled={accountSaveEnabled}
        matchId={matchId}
        courtId={shellCourt}
        courtLogoUrl={shellCourtLogo}
        tab={tab}
        onTab={setTab}
        onBack={clearMatchParams}
      >
        <div className="space-y-4">
          <p className="text-center text-sm font-medium text-cf-muted">{t("loading")}</p>
          <DashboardLoadingSkeleton />
        </div>
      </AppShell>
    );
  }

  if (state.status === "error") {
    return (
      <AppShell
        {...shellUser}
        accountSaveEnabled={accountSaveEnabled}
        matchId={matchId}
        courtId={courtId || "—"}
        courtLogoUrl={shellCourtLogo}
        tab={tab}
        onTab={setTab}
        onBack={clearMatchParams}
      >
        <ErrorState
          title={t("error.title")}
          message={state.message}
          primaryAction={{ label: t("error.retry"), onClick: () => window.location.reload() }}
          secondaryAction={{ label: t("error.changeMatch"), onClick: () => clearMatchParams() }}
        />
      </AppShell>
    );
  }

  if (state.status !== "ok") {
    return null;
  }

  const data = state.data;

  return (
    <AppShell
      {...shellUser}
      accountSaveEnabled={accountSaveEnabled}
      matchId={data.matchId}
      courtId={data.courtId}
      courtLogoUrl={shellCourtLogo}
      tab={tab}
      onTab={setTab}
      onBack={clearMatchParams}
    >
      {tab === "summary" ? <SummaryView data={data} /> : null}
      {tab === "analysis" ? <AnalysisView data={data} /> : null}
      {tab === "replay" ? <ReplayView data={data} /> : null}
    </AppShell>
  );
}
