import { useState } from "react";
import { TopBar } from "./components/TopBar";
import { SourceInputPanel } from "./components/SourceInputPanel";
import { PaperDeconstructor } from "./components/PaperDeconstructor";
import { ConceptGraphView } from "./components/ConceptGraphView";
import { VivaSimulator } from "./components/VivaSimulator";
import type { PaperAnalysis, WorkspaceView } from "./types";

export default function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>("overview");
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (payload: {
    title?: string;
    text?: string;
    fileBase64?: string;
    fileMimeType?: string;
  }) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Analysis failed (${response.status})`);
      }

      setAnalysis(data as PaperAnalysis);
      setActiveView("deconstructor");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete paper analysis. Please try again."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNewAnalysis = () => {
    setError(null);
    setActiveView("overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNavigate = (view: WorkspaceView) => {
    if (view !== "overview" && !analysis) return;
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeView={activeView}
        hasAnalysis={analysis !== null}
        onNavigate={handleNavigate}
        onNewAnalysis={handleNewAnalysis}
      />

      <main className="flex-1">
        {activeView === "overview" && (
          <SourceInputPanel
            isAnalyzing={isAnalyzing}
            error={error}
            onAnalyze={handleAnalyze}
            onClearError={() => setError(null)}
          />
        )}

        {activeView === "deconstructor" && analysis && (
          <PaperDeconstructor analysis={analysis} onNavigate={handleNavigate} />
        )}

        {activeView === "graph" && analysis && (
          <ConceptGraphView analysis={analysis} />
        )}

        {activeView === "viva" && analysis && (
          <VivaSimulator analysis={analysis} />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1360px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>ScholarLens · Academic Paper Deconstructor & Viva Simulator</span>
          {analysis && (
            <button
              type="button"
              onClick={() => handleNavigate("deconstructor")}
              className="text-slate-600 hover:text-slate-900 underline underline-offset-4 truncate max-w-md"
            >
              Active Paper: {analysis.title}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
