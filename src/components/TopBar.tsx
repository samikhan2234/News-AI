import React from "react";
import type { WorkspaceView } from "../types";

interface TopBarProps {
  activeView: WorkspaceView;
  hasAnalysis: boolean;
  onNavigate: (view: WorkspaceView) => void;
  onNewAnalysis: () => void;
}

const NAV_ITEMS: Array<{ id: WorkspaceView; label: string; requiresAnalysis: boolean }> = [
  { id: "overview", label: "Overview", requiresAnalysis: false },
  { id: "deconstructor", label: "Deconstructor", requiresAnalysis: true },
  { id: "graph", label: "Concept Graph", requiresAnalysis: true },
  { id: "viva", label: "Viva Simulator", requiresAnalysis: true },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  hasAnalysis,
  onNavigate,
  onNewAnalysis,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1360px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate("overview")}
          className="font-serif text-xl font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          ScholarLens
        </button>

        {/* Zone 2: 4 single-line navigation links */}
        <nav aria-label="Workspace views" className="hidden md:flex items-center gap-7">
          {NAV_ITEMS.map((item) => {
            const disabled = item.requiresAnalysis && !hasAnalysis;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onNavigate(item.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 ${
                  disabled
                    ? "text-slate-300 cursor-not-allowed"
                    : isActive
                    ? "text-blue-700"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[19px] h-0.5 bg-blue-700"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onNewAnalysis}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            New Analysis
          </button>
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="Mobile workspace views"
        className="flex md:hidden items-center gap-4 px-6 pb-2.5 overflow-x-auto border-t border-slate-100"
      >
        {NAV_ITEMS.map((item) => {
          const disabled = item.requiresAnalysis && !hasAnalysis;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onNavigate(item.id)}
              className={`py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                disabled
                  ? "text-slate-300 cursor-not-allowed"
                  : isActive
                  ? "text-blue-700 underline underline-offset-4"
                  : "text-slate-600"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
