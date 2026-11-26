import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  HelpCircle,
  Info,
  Loader2,
  Network,
  MessageSquare,
} from "lucide-react";
import type { AcademicDepth, ClaimStrength, PaperAnalysis, WorkspaceView } from "../types";

interface PaperDeconstructorProps {
  analysis: PaperAnalysis;
  onNavigate: (view: WorkspaceView) => void;
}

const DEPTH_OPTIONS: Array<{ id: AcademicDepth; label: string }> = [
  { id: "undergraduate", label: "Undergraduate Intro" },
  { id: "graduate", label: "Graduate Seminar" },
  { id: "reviewer", label: "Peer Reviewer Critique" },
];

function StrengthIndicator({ strength }: { strength: ClaimStrength }) {
  if (strength === "Strong") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        Strong Evidence
      </span>
    );
  }
  if (strength === "Caveat") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        Key Caveat
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
      <Info className="w-3.5 h-3.5 shrink-0" />
      Moderate Support
    </span>
  );
}

export const PaperDeconstructor: React.FC<PaperDeconstructorProps> = ({
  analysis,
  onNavigate,
}) => {
  const [selectedDepth, setSelectedDepth] = useState<AcademicDepth>("undergraduate");
  const [selectedTopic, setSelectedTopic] = useState<string>(
    analysis.methodologySteps[0]?.stageTitle ?? analysis.title
  );
  const [streamedText, setStreamedText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const topicChoices = [
    "Core Thesis & Motivation",
    ...analysis.methodologySteps.map((s) => s.stageTitle),
    ...analysis.claimsAndEvidence.slice(0, 2).map((c) => c.claim),
  ];

  const handleStreamExplanation = async (
    topic = selectedTopic,
    depth = selectedDepth
  ) => {
    setIsStreaming(true);
    setStreamError(null);
    setStreamedText("");

    const paperContext = [
      `Thesis: ${analysis.executiveThesis}`,
      `Methodology:\n${analysis.methodologySteps
        .map((s) => `${s.stepNumber}. ${s.stageTitle}: ${s.mechanism} (${s.technicalDetail})`)
        .join("\n")}`,
      `Claims:\n${analysis.claimsAndEvidence
        .map((c) => `- ${c.claim} [${c.strength}] — Limitation: ${c.limitation}`)
        .join("\n")}`,
    ].join("\n\n");

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperTitle: analysis.title,
          paperContext,
          focusTopic: topic,
          depth,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Streaming response unavailable.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = JSON.parse(line.slice(6)) as {
            chunk?: string;
            done?: boolean;
            error?: string;
          };
          if (payload.error) {
            throw new Error(payload.error);
          }
          if (payload.chunk) {
            setStreamedText((prev) => prev + payload.chunk);
          }
        }
      }
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : "Failed to generate explanation.");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleExportMarkdown = () => {
    const md = [
      `# ${analysis.title}`,
      `${analysis.discipline} · ${analysis.readingLevel}`,
      "",
      "## Executive Thesis",
      analysis.executiveThesis,
      "",
      "## Methodology Pipeline",
      ...analysis.methodologySteps.map(
        (s) =>
          `### ${s.stepNumber}. ${s.stageTitle}\n${s.mechanism}\n\n\`${s.technicalDetail}\``
      ),
      "",
      "## Claims & Evidence",
      ...analysis.claimsAndEvidence.map(
        (c) =>
          `- **${c.claim}** (${c.strength})\n  - Evidence: ${c.evidenceAnchor}\n  - Limitation: ${c.limitation}`
      ),
      "",
      "## Key Notation & Terms",
      ...analysis.keyNotation.map((n) => `- \`${n.symbol}\`: ${n.meaning}`),
      "",
      "## Open Research Questions",
      ...analysis.openQuestions.map((q, i) => `${i + 1}. ${q}`),
    ].join("\n\n");

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${analysis.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-brief.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-10 space-y-12">
      {/* Header & Thesis */}
      <section className="pb-8 border-b border-slate-200 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 max-w-4xl">
            <p className="text-xs font-medium text-slate-500 tabular-nums">
              <span>{analysis.discipline}</span>
              <span aria-hidden="true"> · </span>
              <span>{analysis.readingLevel}</span>
              <span aria-hidden="true"> · </span>
              <span>{analysis.conceptNodes.length} Concepts Mapped</span>
              <span aria-hidden="true"> · </span>
              <span>{analysis.methodologySteps.length} Methodology Stages</span>
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 leading-tight">
              {analysis.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export Brief (.md)
            </button>
            <button
              type="button"
              onClick={() => onNavigate("graph")}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Network className="w-3.5 h-3.5" />
              Concept Graph
            </button>
            <button
              type="button"
              onClick={() => onNavigate("viva")}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Start Viva Defense
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-sans text-xs font-semibold tracking-wide text-slate-500 mb-2">
            Executive Thesis
          </h2>
          <p className="text-base text-slate-800 leading-relaxed max-w-4xl">
            {analysis.executiveThesis}
          </p>
        </div>
      </section>

      {/* Methodology Pipeline + Notation */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-5">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-slate-900">
              Methodology Architecture
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Sequential stages and formal mechanisms reconstructed from the source text.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
            {analysis.methodologySteps.map((step) => (
              <div key={step.stepNumber} className="p-5 sm:p-6 space-y-2.5">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-sans text-base font-semibold text-slate-900">
                    <span className="font-mono text-sm text-blue-700 mr-2 tabular-nums">
                      {String(step.stepNumber).padStart(2, "0")}.
                    </span>
                    {step.stageTitle}
                  </h3>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{step.mechanism}</p>
                {step.technicalDetail && (
                  <p className="font-mono text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 overflow-x-auto">
                    {step.technicalDetail}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right rail: Key Notation & Open Questions */}
        <aside className="lg:col-span-4 space-y-8">
          <div className="space-y-4">
            <h2 className="font-serif text-xl font-semibold text-slate-900">
              Key Notation & Terms
            </h2>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
              {analysis.keyNotation.map((item, idx) => (
                <div key={idx} className="p-4 space-y-1">
                  <div className="font-mono text-xs font-medium text-blue-800">
                    {item.symbol}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.meaning}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="font-serif text-xl font-semibold text-slate-900">
              Open Peer-Review Questions
            </h2>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
              {analysis.openQuestions.map((question, idx) => (
                <div key={idx} className="p-4 flex items-start gap-3">
                  <HelpCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-700 leading-relaxed">{question}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {/* Claims & Evidence Verification Matrix */}
      <section className="space-y-5">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-slate-900">
            Claims, Evidence & Limitations
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Critical audit separating verified results from underlying assumptions and caveats.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-5 w-1/3">Claim</th>
                  <th className="py-3.5 px-5 w-1/4">Evidence Anchor</th>
                  <th className="py-3.5 px-5 w-36">Support Level</th>
                  <th className="py-3.5 px-5">Methodological Caveat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {analysis.claimsAndEvidence.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors align-top">
                    <td className="py-4 px-5 font-medium text-slate-900 leading-relaxed">
                      {item.claim}
                    </td>
                    <td className="py-4 px-5 text-xs text-slate-600 leading-relaxed">
                      {item.evidenceAnchor}
                    </td>
                    <td className="py-4 px-5">
                      <StrengthIndicator strength={item.strength} />
                    </td>
                    <td className="py-4 px-5 text-xs text-slate-600 leading-relaxed">
                      {item.limitation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Live Streaming Adaptive Depth Explainer */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-slate-900">
              Adaptive Depth Explainer
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Stream a tailored explanation of any mechanism at undergraduate, graduate, or
              peer-review depth.
            </p>
          </div>

          {/* Interactive segmented control for depth */}
          <div
            role="tablist"
            aria-label="Academic explanation depth"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start"
          >
            {DEPTH_OPTIONS.map((opt) => {
              const active = selectedDepth === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedDepth(opt.id);
                    if (streamedText) {
                      handleStreamExplanation(selectedTopic, opt.id);
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <label htmlFor="topic-select" className="sr-only">
              Select topic to explain
            </label>
            <select
              id="topic-select"
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            >
              {topicChoices.map((topic, i) => (
                <option key={i} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={isStreaming}
            onClick={() => handleStreamExplanation(selectedTopic, selectedDepth)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:bg-slate-300 transition-colors whitespace-nowrap shrink-0"
          >
            {isStreaming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Streaming...
              </>
            ) : (
              <>
                Stream Explanation
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {streamError && (
          <div
            role="alert"
            className="px-4 py-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg"
          >
            {streamError}
          </div>
        )}

        {streamedText ? (
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <p className="text-xs font-medium text-slate-500">
              {DEPTH_OPTIONS.find((d) => d.id === selectedDepth)?.label}
              <span aria-hidden="true"> · </span>
              {selectedTopic}
            </p>
            <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {streamedText}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            Select a topic and depth above, then click Stream Explanation to generate a live
            seminar breakdown.
          </div>
        )}
      </section>
    </div>
  );
};
