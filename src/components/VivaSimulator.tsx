import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  RotateCcw,
} from "lucide-react";
import type {
  PaperAnalysis,
  VivaDifficulty,
  VivaEvaluation,
  VivaTurn,
  VivaVerdict,
} from "../types";

interface VivaSimulatorProps {
  analysis: PaperAnalysis;
}

const DIFFICULTIES: VivaDifficulty[] = [
  "Foundational",
  "Rigorous",
  "Thesis Committee",
];

function VerdictDisplay({ verdict }: { verdict: VivaVerdict }) {
  if (verdict === "Thorough") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        Thorough Defense
      </span>
    );
  }
  if (verdict === "Needs Depth") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        Needs Deeper Grounding
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
      <Info className="w-4 h-4 shrink-0" />
      Partially Grounded
    </span>
  );
}

export const VivaSimulator: React.FC<VivaSimulatorProps> = ({ analysis }) => {
  const [difficulty, setDifficulty] = useState<VivaDifficulty>("Rigorous");
  const [turns, setTurns] = useState<VivaTurn[]>([]);
  const [expectedPoints, setExpectedPoints] = useState<string[]>([]);
  const [answerDraft, setAnswerDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedModelIds, setExpandedModelIds] = useState<Record<string, boolean>>({});

  const paperContext = [
    `Title: ${analysis.title}`,
    `Thesis: ${analysis.executiveThesis}`,
    `Methodology: ${analysis.methodologySteps
      .map((s) => `${s.stepNumber}. ${s.stageTitle}: ${s.mechanism}`)
      .join(" | ")}`,
    `Claims: ${analysis.claimsAndEvidence
      .map((c) => `${c.claim} (Evidence: ${c.evidenceAnchor}; Caveat: ${c.limitation})`)
      .join(" | ")}`,
  ].join("\n\n");

  const startSession = async (chosenDifficulty = difficulty) => {
    setIsLoading(true);
    setError(null);
    setTurns([]);
    setExpectedPoints([]);
    setAnswerDraft("");

    try {
      const response = await fetch("/api/viva/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperTitle: analysis.title,
          executiveThesis: analysis.executiveThesis,
          methodologySummary: analysis.methodologySteps
            .map((s) => `${s.stageTitle}: ${s.mechanism}`)
            .join("; "),
          claimsSummary: analysis.claimsAndEvidence
            .map((c) => c.claim)
            .join("; "),
          difficulty: chosenDifficulty,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not start viva session.");
      }

      setExpectedPoints(data.expectedKeyPoints ?? []);
      setTurns([
        {
          id: `turn-1-${Date.now()}`,
          questionNumber: 1,
          focusArea: data.focusArea || "Core Thesis",
          question: data.question,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize viva examiner.");
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeTurn = turns[turns.length - 1];
    if (!activeTurn || activeTurn.evaluation || !answerDraft.trim() || isLoading) {
      return;
    }

    const candidateText = answerDraft.trim();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/viva/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperContext,
          currentQuestion: activeTurn.question,
          candidateAnswer: candidateText,
          difficulty,
          turnCount: activeTurn.questionNumber,
        }),
      });

      const data = (await response.json()) as VivaEvaluation & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to evaluate response.");
      }

      const updatedCurrent: VivaTurn = {
        ...activeTurn,
        candidateAnswer: candidateText,
        evaluation: data,
      };

      const nextTurn: VivaTurn = {
        id: `turn-${activeTurn.questionNumber + 1}-${Date.now()}`,
        questionNumber: activeTurn.questionNumber + 1,
        focusArea: data.nextFocusArea || "Follow-up Probe",
        question: data.nextQuestion,
      };

      setTurns((prev) => [...prev.slice(0, -1), updatedCurrent, nextTurn]);
      setAnswerDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate defense answer.");
    } finally {
      setIsLoading(false);
    }
  };

  const completedTurns = turns.filter((t) => Boolean(t.evaluation));
  const thoroughCount = completedTurns.filter(
    (t) => t.evaluation?.verdict === "Thorough"
  ).length;
  const activeTurn = turns[turns.length - 1];

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-10 space-y-8">
      {/* Header & Difficulty Selector */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {analysis.title} <span aria-hidden="true">·</span> Oral Defense Examination
          </p>
          <h1 className="font-serif text-3xl font-semibold text-slate-900 mt-1">
            Viva Defense Simulator
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Examination difficulty"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {DIFFICULTIES.map((level) => {
              const active = difficulty === level;
              return (
                <button
                  key={level}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setDifficulty(level)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => startSession(difficulty)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:bg-slate-300 transition-colors whitespace-nowrap shrink-0"
          >
            {turns.length > 0 ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                Restart Session
              </>
            ) : (
              <>
                Start Oral Defense
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="px-4 py-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg"
        >
          {error}
        </div>
      )}

      {/* Empty State before starting */}
      {turns.length === 0 && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-8 space-y-5">
            <h2 className="font-serif text-2xl font-semibold text-slate-900">
              Prepare for committee questioning
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
              The examiner generates targeted questions grounded directly in{" "}
              <span className="font-medium text-slate-900">{analysis.title}</span>. Each
              response is evaluated for technical accuracy, mechanism clarity, and empirical
              evidence, followed by an adaptive follow-up probe.
            </p>
            <button
              type="button"
              onClick={() => startSession(difficulty)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors"
            >
              Begin {difficulty} Examination
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Suggested Defense Focus Areas
            </h3>
            <div className="divide-y divide-slate-200 text-xs text-slate-600">
              {analysis.openQuestions.map((q, idx) => (
                <p key={idx} className="py-3 first:pt-0 last:pb-0 leading-relaxed">
                  {q}
                </p>
              ))}
            </div>
          </aside>
        </div>
      )}

      {turns.length === 0 && isLoading && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 flex items-center gap-3 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
          Preparing examiner opening question from paper claims and methodology...
        </div>
      )}

      {/* Active Session Layout */}
      {turns.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Transcript & Active Answer Box */}
          <div className="lg:col-span-8 space-y-6">
            {turns.map((turn) => {
              const isCurrent = turn.id === activeTurn?.id && !turn.evaluation;
              const modelExpanded = Boolean(expandedModelIds[turn.id]);

              return (
                <div
                  key={turn.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <span className="text-xs font-medium text-slate-500 tabular-nums">
                      Question {String(turn.questionNumber).padStart(2, "0")}{" "}
                      <span aria-hidden="true">·</span> {turn.focusArea}
                    </span>
                    {turn.evaluation && <VerdictDisplay verdict={turn.evaluation.verdict} />}
                  </div>

                  <p className="font-serif text-lg font-medium text-slate-900 leading-relaxed">
                    {turn.question}
                  </p>

                  {turn.candidateAnswer && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                      <p className="text-xs font-semibold text-slate-500">Your Defense</p>
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {turn.candidateAnswer}
                      </p>
                    </div>
                  )}

                  {turn.evaluation && (
                    <div className="space-y-4 pt-2 border-t border-slate-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-emerald-700">
                            Verified Strengths
                          </h4>
                          <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed list-disc pl-4">
                            {turn.evaluation.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-amber-700">
                            Gaps to Tighten
                          </h4>
                          <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed list-disc pl-4">
                            {turn.evaluation.gapsToAddress.map((g, i) => (
                              <li key={i}>{g}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedModelIds((prev) => ({
                              ...prev,
                              [turn.id]: !prev[turn.id],
                            }))
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800"
                        >
                          {modelExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              Hide Reference Answer Outline
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              View Reference Answer Outline
                            </>
                          )}
                        </button>

                        {modelExpanded && (
                          <div className="mt-2.5 p-4 bg-blue-50/60 border border-blue-200 rounded-lg text-xs text-slate-800 leading-relaxed">
                            {turn.evaluation.modelAnswerOutline}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isCurrent && (
                    <form onSubmit={submitAnswer} className="space-y-3 pt-2">
                      <label
                        htmlFor="viva-answer"
                        className="block text-xs font-semibold text-slate-600"
                      >
                        Your Oral Defense Response
                      </label>
                      <textarea
                        id="viva-answer"
                        rows={4}
                        value={answerDraft}
                        disabled={isLoading}
                        onChange={(e) => setAnswerDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                            e.preventDefault();
                            submitAnswer(e);
                          }
                        }}
                        placeholder="Defend the claim using mechanisms, equations, or empirical tradeoffs from the paper..."
                        className="w-full px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                      />
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-slate-400">
                          Press Ctrl+Enter to submit
                        </span>
                        <button
                          type="submit"
                          disabled={isLoading || !answerDraft.trim()}
                          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Evaluating Defense...
                            </>
                          ) : (
                            <>
                              Submit Defense
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Rail: Session Rubric Summary & Hints */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Session Progress</h2>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">Answered</p>
                  <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-0.5">
                    {completedTurns.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Thorough Verdicts</p>
                  <p className="font-mono text-2xl font-semibold text-emerald-700 tabular-nums mt-0.5">
                    {thoroughCount}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                Difficulty: <span className="font-medium text-slate-700">{difficulty}</span>
              </p>
            </div>

            {expectedPoints.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Opening Question Rubric Hints
                </h2>
                <ul className="space-y-2 text-xs text-slate-600 leading-relaxed list-disc pl-4">
                  {expectedPoints.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
