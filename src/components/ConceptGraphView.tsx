import React, { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Layers, Loader2 } from "lucide-react";
import type { ConceptCategory, ConceptNode, PaperAnalysis } from "../types";

interface ConceptGraphViewProps {
  analysis: PaperAnalysis;
}

type CategoryFilter = "All" | ConceptCategory;

const CATEGORIES: CategoryFilter[] = ["All", "Core", "Mechanism", "Assumption", "Outcome"];

const TIER_LABELS: Record<number, string> = {
  0: "Foundational Inputs",
  1: "Core Mechanisms",
  2: "Outcomes & Implications",
};

function categoryAccent(category: ConceptCategory, selected: boolean) {
  if (selected) {
    return {
      fill: "#1D4ED8",
      stroke: "#1E40AF",
      text: "#FFFFFF",
      subtext: "#DBEAFE",
    };
  }
  switch (category) {
    case "Core":
      return {
        fill: "#EFF6FF",
        stroke: "#93C5FD",
        text: "#0F172A",
        subtext: "#1D4ED8",
      };
    case "Mechanism":
      return {
        fill: "#FFFFFF",
        stroke: "#CBD5E1",
        text: "#0F172A",
        subtext: "#475569",
      };
    case "Assumption":
      return {
        fill: "#FFFBEB",
        stroke: "#FCD34D",
        text: "#0F172A",
        subtext: "#B45309",
      };
    case "Outcome":
      return {
        fill: "#ECFDF5",
        stroke: "#6EE7B7",
        text: "#0F172A",
        subtext: "#047857",
      };
  }
}

interface PositionedNode extends ConceptNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ConceptGraphView: React.FC<ConceptGraphViewProps> = ({ analysis }) => {
  const [filter, setFilter] = useState<CategoryFilter>("All");
  const [selectedId, setSelectedId] = useState<string>(
    analysis.conceptNodes[0]?.id ?? ""
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [conceptExplanation, setConceptExplanation] = useState<string>("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const svgWidth = 920;
  const svgHeight = 520;
  const nodeWidth = 200;
  const nodeHeight = 68;

  const positionedNodes = useMemo<PositionedNode[]>(() => {
    const tiers: Record<number, ConceptNode[]> = { 0: [], 1: [], 2: [] };
    for (const node of analysis.conceptNodes) {
      const clampedTier = Math.max(0, Math.min(2, Number(node.tier) || 0));
      tiers[clampedTier].push(node);
    }

    const colX: Record<number, number> = {
      0: 150,
      1: 460,
      2: 770,
    };

    const result: PositionedNode[] = [];
    for (const tierIdx of [0, 1, 2]) {
      const list = tiers[tierIdx];
      const count = list.length;
      if (count === 0) continue;

      const topMargin = 76;
      const availableHeight = svgHeight - topMargin - 36;
      const step = availableHeight / count;

      list.forEach((node, idx) => {
        const yCenter = topMargin + step * idx + step / 2;
        result.push({
          ...node,
          x: colX[tierIdx],
          y: yCenter,
          width: nodeWidth,
          height: nodeHeight,
        });
      });
    }
    return result;
  }, [analysis.conceptNodes]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    for (const n of positionedNodes) {
      map.set(n.id, n);
    }
    return map;
  }, [positionedNodes]);

  const validEdges = useMemo(() => {
    return analysis.conceptEdges.filter(
      (e) => nodeMap.has(e.source) && nodeMap.has(e.target) && e.source !== e.target
    );
  }, [analysis.conceptEdges, nodeMap]);

  const activeFocusId = hoveredId ?? selectedId;
  const selectedNode = nodeMap.get(selectedId) ?? positionedNodes[0] ?? null;

  const incomingEdges = useMemo(
    () => validEdges.filter((e) => e.target === selectedNode?.id),
    [validEdges, selectedNode]
  );
  const outgoingEdges = useMemo(
    () => validEdges.filter((e) => e.source === selectedNode?.id),
    [validEdges, selectedNode]
  );

  const handleSelectNode = (id: string) => {
    setSelectedId(id);
    setConceptExplanation("");
    setExplainError(null);
  };

  const handleExplainConcept = async (node: ConceptNode) => {
    setIsExplaining(true);
    setExplainError(null);
    setConceptExplanation("");

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperTitle: analysis.title,
          paperContext: `Thesis: ${analysis.executiveThesis}\nConcept Definition: ${node.definition}\nRole in Paper: ${node.roleInPaper}`,
          focusTopic: node.label,
          depth: "graduate",
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming unavailable.");

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
            error?: string;
          };
          if (payload.error) throw new Error(payload.error);
          if (payload.chunk) {
            setConceptExplanation((prev) => prev + payload.chunk);
          }
        }
      }
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : "Failed to explain concept.");
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-10 space-y-6">
      {/* Header & Interactive Category Filter */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {analysis.title} <span aria-hidden="true">·</span> {positionedNodes.length} Nodes{" "}
            <span aria-hidden="true">·</span> {validEdges.length} Causal Links
          </p>
          <h1 className="font-serif text-3xl font-semibold text-slate-900 mt-1">
            Interactive Concept Knowledge Graph
          </h1>
        </div>

        <div
          role="group"
          aria-label="Filter concepts by category"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start"
        >
          {CATEGORIES.map((cat) => {
            const active = filter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2-Zone Sandbox Layout: 65% Interactive SVG Stage + 35% Concept Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Interactive Stage */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <Layers className="w-3.5 h-3.5 text-blue-700" />
              Directed Dependency Flow (Click any node to inspect)
            </span>
            <span className="hidden sm:inline tabular-nums">
              Foundational → Mechanism → Outcome
            </span>
          </div>

          <div className="w-full overflow-x-auto bg-slate-50/50">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full min-w-[720px] h-auto select-none"
              role="img"
              aria-label="Concept knowledge graph"
            >
              <defs>
                <marker
                  id="arrow-muted"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#94A3B8" />
                </marker>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#1D4ED8" />
                </marker>
              </defs>

              {/* Tier Column Headers */}
              {[0, 1, 2].map((tierIdx) => {
                const xPos = tierIdx === 0 ? 150 : tierIdx === 1 ? 460 : 770;
                return (
                  <g key={tierIdx}>
                    <text
                      x={xPos}
                      y={34}
                      textAnchor="middle"
                      fill="#64748B"
                      fontSize="11"
                      fontWeight="600"
                    >
                      {TIER_LABELS[tierIdx]}
                    </text>
                    <line
                      x1={xPos - 90}
                      y1={46}
                      x2={xPos + 90}
                      y2={46}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                    />
                  </g>
                );
              })}

              {/* Directed Edges */}
              {validEdges.map((edge, idx) => {
                const src = nodeMap.get(edge.source);
                const tgt = nodeMap.get(edge.target);
                if (!src || !tgt) return null;

                const isConnected =
                  activeFocusId === src.id || activeFocusId === tgt.id;
                const matchesFilter =
                  filter === "All" ||
                  src.category === filter ||
                  tgt.category === filter;

                const startX =
                  src.x === tgt.x
                    ? src.x + src.width / 2
                    : src.x < tgt.x
                    ? src.x + src.width / 2
                    : src.x - src.width / 2;
                const startY = src.y;

                const endX =
                  src.x === tgt.x
                    ? tgt.x + tgt.width / 2
                    : src.x < tgt.x
                    ? tgt.x - tgt.width / 2 - 4
                    : tgt.x + tgt.width / 2 + 4;
                const endY = tgt.y;

                const dx = Math.abs(endX - startX);
                const cpOffset = src.x === tgt.x ? 70 : Math.max(55, dx * 0.45);
                const pathD =
                  src.x === tgt.x
                    ? `M ${startX} ${startY} C ${startX + cpOffset} ${startY}, ${endX + cpOffset} ${endY}, ${endX} ${endY}`
                    : `M ${startX} ${startY} C ${
                        src.x < tgt.x ? startX + cpOffset : startX - cpOffset
                      } ${startY}, ${
                        src.x < tgt.x ? endX - cpOffset : endX + cpOffset
                      } ${endY}, ${endX} ${endY}`;

                const midX =
                  src.x === tgt.x ? startX + cpOffset * 0.72 : (startX + endX) / 2;
                const midY = (startY + endY) / 2;

                return (
                  <g
                    key={`${edge.source}-${edge.target}-${idx}`}
                    opacity={matchesFilter ? (isConnected ? 1 : 0.45) : 0.12}
                  >
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isConnected ? "#1D4ED8" : "#94A3B8"}
                      strokeWidth={isConnected ? 2.2 : 1.4}
                      markerEnd={
                        isConnected ? "url(#arrow-active)" : "url(#arrow-muted)"
                      }
                    />
                    {isConnected && (
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x={-52}
                          y={-11}
                          width={104}
                          height={22}
                          rx={4}
                          fill="#FFFFFF"
                          stroke="#BFDBFE"
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={4}
                          textAnchor="middle"
                          fill="#1E40AF"
                          fontSize="10"
                          fontWeight="600"
                        >
                          {edge.relation.slice(0, 18)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Concept Nodes */}
              {positionedNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const matchesFilter = filter === "All" || node.category === filter;
                const colors = categoryAccent(node.category, isSelected);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x - node.width / 2}, ${
                      node.y - node.height / 2
                    })`}
                    onClick={() => handleSelectNode(node.id)}
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    opacity={matchesFilter ? 1 : 0.25}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.label} (${node.category})`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectNode(node.id);
                      }
                    }}
                  >
                    <rect
                      width={node.width}
                      height={node.height}
                      rx={10}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={isSelected ? 2 : 1.25}
                    />
                    <text
                      x={14}
                      y={24}
                      fill={colors.subtext}
                      fontSize="10"
                      fontWeight="600"
                    >
                      {node.category}
                    </text>
                    <text
                      x={14}
                      y={46}
                      fill={colors.text}
                      fontSize="13"
                      fontWeight="600"
                    >
                      {node.label.length > 24
                        ? `${node.label.slice(0, 22)}...`
                        : node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right Zone: Concept Inspector */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          {selectedNode ? (
            <>
              <div className="space-y-1.5 border-b border-slate-200 pb-4">
                <p className="text-xs font-medium text-blue-700">
                  {selectedNode.category} Concept <span aria-hidden="true">·</span>{" "}
                  {TIER_LABELS[Math.max(0, Math.min(2, selectedNode.tier))] ?? "Concept"}
                </p>
                <h2 className="font-serif text-2xl font-semibold text-slate-900">
                  {selectedNode.label}
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1">
                    Academic Definition
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {selectedNode.definition}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1">
                    Role in This Paper
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {selectedNode.roleInPaper}
                  </p>
                </div>
              </div>

              {/* Connected Nodes Navigation */}
              {(incomingEdges.length > 0 || outgoingEdges.length > 0) && (
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500">
                    Connected Concepts
                  </h3>
                  <div className="space-y-2">
                    {incomingEdges.map((edge, idx) => {
                      const src = nodeMap.get(edge.source);
                      if (!src) return null;
                      return (
                        <button
                          key={`in-${idx}`}
                          type="button"
                          onClick={() => handleSelectNode(src.id)}
                          className="w-full text-left px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between gap-2 transition-colors"
                        >
                          <span className="text-slate-700 truncate">
                            <span className="font-medium text-slate-900">{src.label}</span>{" "}
                            <span className="text-slate-500">{edge.relation} this</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>
                      );
                    })}
                    {outgoingEdges.map((edge, idx) => {
                      const tgt = nodeMap.get(edge.target);
                      if (!tgt) return null;
                      return (
                        <button
                          key={`out-${idx}`}
                          type="button"
                          onClick={() => handleSelectNode(tgt.id)}
                          className="w-full text-left px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between gap-2 transition-colors"
                        >
                          <span className="text-slate-700 truncate">
                            <span className="text-slate-500">{edge.relation}</span>{" "}
                            <span className="font-medium text-slate-900">{tgt.label}</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Live Streaming Deep Dive on Selected Node */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <button
                  type="button"
                  disabled={isExplaining}
                  onClick={() => handleExplainConcept(selectedNode)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:bg-slate-300 transition-colors"
                >
                  {isExplaining ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Streaming Deep Dive...
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-3.5 h-3.5" />
                      Stream Seminar Explanation
                    </>
                  )}
                </button>

                {explainError && (
                  <p role="alert" className="text-xs text-red-700">
                    {explainError}
                  </p>
                )}

                {conceptExplanation && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {conceptExplanation}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a concept node to inspect details.</p>
          )}
        </aside>
      </div>
    </div>
  );
};
