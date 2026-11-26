import React, { useRef, useState } from "react";
import { ArrowRight, BookOpen, FileText, Loader2, Upload, X } from "lucide-react";
import { SAMPLE_PAPERS } from "../data/samplePapers";
import type { SamplePaper } from "../types";

interface SourceInputPanelProps {
  isAnalyzing: boolean;
  error: string | null;
  onAnalyze: (payload: {
    title?: string;
    text?: string;
    fileBase64?: string;
    fileMimeType?: string;
  }) => void;
  onClearError: () => void;
}

const HERO_IMAGE_PATH = "/src/assets/images/scholar_research_blueprint_1795677328358.jpg";

export const SourceInputPanel: React.FC<SourceInputPanelProps> = ({
  isAnalyzing,
  error,
  onAnalyze,
  onClearError,
}) => {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    mimeType: string;
    base64: string;
    sizeLabel: string;
  } | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSampleSelect = (sample: SamplePaper) => {
    onClearError();
    setUploadedFile(null);
    setTitle(sample.title);
    setText(sample.excerpt);
    onAnalyze({ title: sample.title, text: sample.excerpt });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onClearError();

    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    const sizeLabel = sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

    if (file.type === "text/plain" || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = () => {
        const content = typeof reader.result === "string" ? reader.result : "";
        setText(content);
        if (!title) {
          setTitle(file.name.replace(/\.(txt|md)$/i, ""));
        }
        setUploadedFile(null);
      };
      reader.readAsText(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      setUploadedFile({
        name: file.name,
        mimeType: file.type || "application/pdf",
        base64,
        sizeLabel,
      });
      if (!title) {
        setTitle(file.name.replace(/\.pdf$/i, ""));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnalyzing) return;
    onAnalyze({
      title: title.trim() || undefined,
      text: text.trim() || undefined,
      fileBase64: uploadedFile?.base64,
      fileMimeType: uploadedFile?.mimeType,
    });
  };

  const canSubmit = (text.trim().length > 0 || uploadedFile !== null) && !isAnalyzing;

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-10 space-y-12">
      {/* Main 2-column split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        {/* Left column: Intake & Controls */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-medium tracking-wide text-blue-700">
              Academic Research Synthesis & Oral Defense Workbench
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[42px] font-semibold tracking-tight text-slate-900 leading-[1.15] max-w-2xl">
              Deconstruct dense papers into structured understanding
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
              Paste a research abstract, upload a PDF manuscript, or load a landmark paper below.
              ScholarLens extracts methodology stages, verifies empirical claims, maps causal
              concepts, and conducts a live viva examination.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label htmlFor="paper-title" className="text-sm font-semibold text-slate-900">
                Source Material
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                  onChange={handleFileChange}
                  className="hidden"
                  id="paper-file-upload"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload PDF or Notes
                </button>
              </div>
            </div>

            {uploadedFile && (
              <div className="flex items-center justify-between gap-4 px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-blue-700 shrink-0" />
                  <span className="text-sm font-medium text-slate-900 truncate">
                    {uploadedFile.name}
                  </span>
                  <span className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
                    {uploadedFile.sizeLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadedFile(null)}
                  aria-label="Remove uploaded file"
                  className="p-1 text-slate-500 hover:text-slate-900 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div>
              <input
                id="paper-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional paper or lecture title..."
                disabled={isAnalyzing}
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="paper-excerpt" className="sr-only">
                Paper text or abstract
              </label>
              <textarea
                id="paper-excerpt"
                rows={7}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isAnalyzing}
                placeholder="Paste a research abstract, methodology section, or lecture transcript here..."
                className="w-full px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors resize-y"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="px-4 py-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg"
              >
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <span className="text-xs text-slate-500 tabular-nums">
                {text.trim()
                  ? `${text.trim().split(/\s+/).length} words ready`
                  : uploadedFile
                  ? "Document attached for multimodal parsing"
                  : "Supports pasted excerpts, .txt, .md, and .pdf"}
              </span>

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deconstructing Material...
                  </>
                ) : (
                  <>
                    Deconstruct Paper
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right column: Editorial Visual & Pipeline Overview */}
        <div className="lg:col-span-5 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="relative h-64 lg:flex-1 min-h-[240px] bg-slate-900">
            {!imgFailed ? (
              <img
                src={HERO_IMAGE_PATH}
                alt="Academic desk with bound engineering monographs, open schematic notebook, and brass divider"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-800 to-slate-950 text-slate-200">
                <BookOpen className="w-10 h-10 mb-3 text-blue-400" />
                <p className="font-serif text-lg font-medium">ScholarLens Research Studio</p>
              </div>
            )}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent"
            />
            <div className="absolute bottom-4 left-5 right-5 text-white">
              <p className="text-xs font-medium text-slate-200">
                Structured Synthesis Pipeline
              </p>
              <p className="font-serif text-lg font-medium mt-0.5">
                From raw manuscript to seminar defense
              </p>
            </div>
          </div>

          <div className="p-6 divide-y divide-slate-200">
            <div className="pb-4">
              <h2 className="font-sans text-sm font-semibold text-slate-900">
                01. Mechanism & Claim Extraction
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Separates step-by-step methodology and formal notation from empirical claims and
                methodological caveats.
              </p>
            </div>
            <div className="py-4">
              <h2 className="font-sans text-sm font-semibold text-slate-900">
                02. Interactive Concept Knowledge Graph
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Maps foundational assumptions, core mechanisms, and outcomes into a navigable
                directed graph with depth-adaptive explanations.
              </p>
            </div>
            <div className="pt-4">
              <h2 className="font-sans text-sm font-semibold text-slate-900">
                03. Examiner Viva Defense Simulation
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Tests comprehension through targeted oral-exam questions, rubric-aligned feedback,
                and iterative follow-up probes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Curated Landmark Papers Strip for 1-Click Demo */}
      <section className="pt-4 border-t border-slate-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-serif text-xl font-semibold text-slate-900">
              Curated Landmark Papers
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Select a canonical paper excerpt to launch a complete structured analysis immediately.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SAMPLE_PAPERS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              disabled={isAnalyzing}
              onClick={() => handleSampleSelect(sample)}
              className="group text-left p-5 bg-white border border-slate-200 rounded-xl hover:border-blue-700 transition-colors flex flex-col justify-between gap-4 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  {sample.discipline} <span aria-hidden="true">·</span> {sample.authorsAndYear}
                </p>
                <h3 className="font-serif text-lg font-semibold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                  {sample.title}
                </h3>
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {sample.excerpt.replace(/^Title:.*\n+/i, "").slice(0, 180)}...
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
                Load & Deconstruct
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
