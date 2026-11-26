export type ClaimStrength = "Strong" | "Moderate" | "Caveat";

export type ConceptCategory = "Core" | "Mechanism" | "Assumption" | "Outcome";

export type AcademicDepth = "undergraduate" | "graduate" | "reviewer";

export type VivaDifficulty = "Foundational" | "Rigorous" | "Thesis Committee";

export type VivaVerdict = "Thorough" | "Partially Grounded" | "Needs Depth";

export type WorkspaceView = "overview" | "deconstructor" | "graph" | "viva";

export interface MethodologyStep {
  stepNumber: number;
  stageTitle: string;
  mechanism: string;
  technicalDetail: string;
}

export interface ClaimEvidence {
  claim: string;
  evidenceAnchor: string;
  strength: ClaimStrength;
  limitation: string;
}

export interface ConceptNode {
  id: string;
  label: string;
  category: ConceptCategory;
  tier: number;
  definition: string;
  roleInPaper: string;
}

export interface ConceptEdge {
  source: string;
  target: string;
  relation: string;
}

export interface NotationEntry {
  symbol: string;
  meaning: string;
}

export interface PaperAnalysis {
  title: string;
  discipline: string;
  readingLevel: string;
  executiveThesis: string;
  methodologySteps: MethodologyStep[];
  claimsAndEvidence: ClaimEvidence[];
  conceptNodes: ConceptNode[];
  conceptEdges: ConceptEdge[];
  keyNotation: NotationEntry[];
  openQuestions: string[];
}

export interface SamplePaper {
  id: string;
  title: string;
  authorsAndYear: string;
  discipline: string;
  excerpt: string;
}

export interface VivaEvaluation {
  verdict: VivaVerdict;
  strengths: string[];
  gapsToAddress: string[];
  modelAnswerOutline: string;
  nextQuestion: string;
  nextFocusArea: string;
}

export interface VivaTurn {
  id: string;
  questionNumber: number;
  focusArea: string;
  question: string;
  candidateAnswer?: string;
  evaluation?: VivaEvaluation;
}
