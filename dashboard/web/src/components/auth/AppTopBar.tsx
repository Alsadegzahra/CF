import { useState } from "react";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { AccountMenu } from "./AccountMenu";
import { AuthModal } from "./AuthModal";

type AppTopBarProps = {
  onOpenFriends?: () => void;
  onOpenSavedMatches?: () => void;
  onOpenFeed?: () => void;
  onOpenProfile?: () => void;
};

export function AppTopBar({ onOpenFriends, onOpenSavedMatches, onOpenFeed, onOpenProfile }: AppTopBarProps) {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <LanguageSwitcher />
        <AccountMenu
          onOpenAuth={() => setAuthOpen(true)}
          onOpenFriends={onOpenFriends}
          onOpenSavedMatches={onOpenSavedMatches}
          onOpenFeed={onOpenFeed}
          onOpenProfile={onOpenProfile}
        />
      </div>
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onOpenFriends={onOpenFriends}
        onOpenSavedMatches={onOpenSavedMatches}
        onOpenFeed={onOpenFeed}
        onOpenProfile={onOpenProfile}
      />
    </>
  );
}
