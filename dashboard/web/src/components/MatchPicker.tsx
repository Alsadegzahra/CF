import { useState } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { TextField } from "./ui/TextField";

type MatchPickerProps = {
  onSubmit: (matchId: string, courtId: string) => void;
  onTryDemo: () => void;
};

export function MatchPicker({ onSubmit, onTryDemo }: MatchPickerProps) {
  const { t } = usePreferences();
  const [courtId, setCourtId] = useState("");
  const [matchId, setMatchId] = useState("");

  function submit() {
    const m = matchId.trim();
    if (!m) return;
    const c = courtId.trim();
    onSubmit(m, c);
  }

  return (
    <div className="mx-auto mt-8 max-w-[420px] px-5 pb-12">
      <Card padding="lg" className="border-cf-line/80 shadow-card">
        <h1 className="mb-2 text-xl font-extrabold tracking-tight text-cf-navy">{t("match.title")}</h1>
        <p className="mb-6 text-sm leading-relaxed text-cf-muted">
          {t("match.hint")}{" "}
          <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-cf-lime-dark">uvicorn src.app.api:app</code>
          ).
        </p>

        <div className="space-y-4">
          <TextField
            id="courtflow-court"
            label={t("match.court")}
            value={courtId}
            onChange={(e) => setCourtId(e.target.value)}
            placeholder="e.g. court_002"
            autoComplete="off"
          />
          <TextField
            id="courtflow-match"
            label={t("match.id")}
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            placeholder="e.g. match_2026_03_28_002827"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoComplete="off"
          />
        </div>

        <Button type="button" variant="primary" className="mt-6 w-full font-bold" onClick={submit}>
          {t("match.load")}
        </Button>

        <p className="mb-3 mt-6 text-center text-xs text-cf-muted">{t("match.demoHint")}</p>
        <Button type="button" variant="secondary" className="w-full font-bold" onClick={onTryDemo}>
          {t("match.tryDemo")}
        </Button>
      </Card>
    </div>
  );
}
