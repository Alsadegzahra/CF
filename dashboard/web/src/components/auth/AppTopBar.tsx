import { useState } from "react";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { AccountMenu } from "./AccountMenu";
import { AuthModal } from "./AuthModal";

type AppTopBarProps = {
  onOpenFriends?: () => void;
  onOpenSavedMatches?: () => void;
};

/** Language + account — same placement on match-picker and in-app shells. */
export function AppTopBar({ onOpenFriends, onOpenSavedMatches }: AppTopBarProps) {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <LanguageSwitcher />
        <AccountMenu
          onOpenAuth={() => setAuthOpen(true)}
          onOpenFriends={onOpenFriends}
          onOpenSavedMatches={onOpenSavedMatches}
        />
      </div>
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onOpenFriends={onOpenFriends}
        onOpenSavedMatches={onOpenSavedMatches}
      />
    </>
  );
}
