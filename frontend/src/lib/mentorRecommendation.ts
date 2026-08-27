import { FeedbackScores, DetailedRubric } from "./interviewApi";

export interface WeaknessItem {
  key: string;
  label: string;
  score: number;
  tags: string[];
}

export interface MentorRecommendationResult {
  isRecommended: boolean;
  weaknesses: WeaknessItem[];
  reason: string;
  searchTags: string[];
  filterSummary: string;
}

// Real topic mapping based on competency dimensions
export const COMPETENCY_MENTOR_TAGS: Record<string, { label: string; tags: string[] }> = {
  communication: {
    label: "Communication",
    tags: [
      "Communication",
      "Interview Preparation",
      "Career Coaching",
      "Behavioral",
      "Soft Skills",
      "HR",
      "Presentation",
      "English",
    ],
  },
  confidence: {
    label: "Confidence",
    tags: [
      "Confidence",
      "Interview Preparation",
      "Career Coaching",
      "Behavioral",
      "Soft Skills",
      "Mock Interview",
      "Leadership",
    ],
  },
  technical_knowledge: {
    label: "Technical Knowledge",
    tags: [
      "System Design",
      "Backend",
      "Frontend",
      "Full Stack",
      "Distributed Systems",
      "Architecture",
      "DevOps",
      "Cloud",
      "Database Design",
    ],
  },
  problem_solving: {
    label: "Problem Solving",
    tags: [
      "DSA",
      "Algorithms",
      "Data Structures",
      "Problem Solving",
      "Competitive Programming",
      "Coding",
      "LeetCode",
    ],
  },
  answer_quality: {
    label: "Answer Quality",
    tags: [
      "Interview Preparation",
      "System Design",
      "STAR Method",
      "Architecture",
      "Code Quality",
      "Mock Interview",
    ],
  },
  professionalism: {
    label: "Professionalism",
    tags: [
      "Behavioral",
      "Culture Fit",
      "Leadership",
      "Career Coaching",
      "Interview Preparation",
      "Professionalism",
    ],
  },
};

/**
 * Analyzes real student performance scores from an interviewer's submitted feedback
 * or rubric and determines if 1-to-1 mentoring is recommended.
 * 
 * Example:
 * Communication = 58
 * Technical = 82
 * Confidence = 61
 * -> Weaknesses: Communication (58), Confidence (61)
 * -> Reason: "Communication and confidence are areas that need improvement."
 */
export function analyzePerformanceForMentorship(
  scores?: FeedbackScores | null,
  rubric?: DetailedRubric | null,
  overallScore?: number | null
): MentorRecommendationResult {
  const weaknesses: WeaknessItem[] = [];
  const scoreThreshold = 70;

  if (scores) {
    if (typeof scores.communication === "number" && scores.communication < scoreThreshold) {
      weaknesses.push({
        key: "communication",
        label: COMPETENCY_MENTOR_TAGS.communication.label,
        score: scores.communication,
        tags: COMPETENCY_MENTOR_TAGS.communication.tags,
      });
    }

    if (typeof scores.confidence === "number" && scores.confidence < scoreThreshold) {
      weaknesses.push({
        key: "confidence",
        label: COMPETENCY_MENTOR_TAGS.confidence.label,
        score: scores.confidence,
        tags: COMPETENCY_MENTOR_TAGS.confidence.tags,
      });
    }

    if (typeof scores.technical_knowledge === "number" && scores.technical_knowledge < scoreThreshold) {
      weaknesses.push({
        key: "technical_knowledge",
        label: COMPETENCY_MENTOR_TAGS.technical_knowledge.label,
        score: scores.technical_knowledge,
        tags: COMPETENCY_MENTOR_TAGS.technical_knowledge.tags,
      });
    }

    if (typeof scores.problem_solving === "number" && scores.problem_solving < scoreThreshold) {
      weaknesses.push({
        key: "problem_solving",
        label: COMPETENCY_MENTOR_TAGS.problem_solving.label,
        score: scores.problem_solving,
        tags: COMPETENCY_MENTOR_TAGS.problem_solving.tags,
      });
    }

    if (typeof scores.answer_quality === "number" && scores.answer_quality < scoreThreshold) {
      weaknesses.push({
        key: "answer_quality",
        label: COMPETENCY_MENTOR_TAGS.answer_quality.label,
        score: scores.answer_quality,
        tags: COMPETENCY_MENTOR_TAGS.answer_quality.tags,
      });
    }

    if (typeof scores.professionalism === "number" && scores.professionalism < scoreThreshold) {
      weaknesses.push({
        key: "professionalism",
        label: COMPETENCY_MENTOR_TAGS.professionalism.label,
        score: scores.professionalism,
        tags: COMPETENCY_MENTOR_TAGS.professionalism.tags,
      });
    }
  } else if (rubric) {
    if (typeof rubric.communication_clarity === "number" && rubric.communication_clarity < scoreThreshold) {
      weaknesses.push({
        key: "communication",
        label: COMPETENCY_MENTOR_TAGS.communication.label,
        score: rubric.communication_clarity,
        tags: COMPETENCY_MENTOR_TAGS.communication.tags,
      });
    }
    if (typeof rubric.system_architecture === "number" && rubric.system_architecture < scoreThreshold) {
      weaknesses.push({
        key: "technical_knowledge",
        label: COMPETENCY_MENTOR_TAGS.technical_knowledge.label,
        score: rubric.system_architecture,
        tags: COMPETENCY_MENTOR_TAGS.technical_knowledge.tags,
      });
    }
    if (typeof rubric.dsa_problem_solving === "number" && rubric.dsa_problem_solving < scoreThreshold) {
      weaknesses.push({
        key: "problem_solving",
        label: COMPETENCY_MENTOR_TAGS.problem_solving.label,
        score: rubric.dsa_problem_solving,
        tags: COMPETENCY_MENTOR_TAGS.problem_solving.tags,
      });
    }
    if (typeof rubric.code_quality === "number" && rubric.code_quality < scoreThreshold) {
      weaknesses.push({
        key: "answer_quality",
        label: COMPETENCY_MENTOR_TAGS.answer_quality.label,
        score: rubric.code_quality,
        tags: COMPETENCY_MENTOR_TAGS.answer_quality.tags,
      });
    }
    if (typeof rubric.behavioral_culture_fit === "number" && rubric.behavioral_culture_fit < scoreThreshold) {
      weaknesses.push({
        key: "confidence",
        label: COMPETENCY_MENTOR_TAGS.confidence.label,
        score: rubric.behavioral_culture_fit,
        tags: COMPETENCY_MENTOR_TAGS.confidence.tags,
      });
    }
  } else if (typeof overallScore === "number" && overallScore < scoreThreshold) {
    weaknesses.push({
      key: "technical_knowledge",
      label: "Technical Knowledge",
      score: overallScore,
      tags: COMPETENCY_MENTOR_TAGS.technical_knowledge.tags,
    });
  }

  if (weaknesses.length === 0) {
    return {
      isRecommended: false,
      weaknesses: [],
      reason: "",
      searchTags: [],
      filterSummary: "",
    };
  }

  // Format natural language reason
  // E.g., "Communication and confidence are areas that need improvement."
  let reason = "";
  if (weaknesses.length === 1) {
    reason = `${weaknesses[0].label} is an area that needs improvement.`;
  } else if (weaknesses.length === 2) {
    reason = `${weaknesses[0].label} and ${weaknesses[1].label.toLowerCase()} are areas that need improvement.`;
  } else {
    const allExceptLast = weaknesses
      .slice(0, -1)
      .map((w, idx) => (idx === 0 ? w.label : w.label.toLowerCase()))
      .join(", ");
    const last = weaknesses[weaknesses.length - 1].label.toLowerCase();
    reason = `${allExceptLast}, and ${last} are areas that need improvement.`;
  }

  // Deduplicate search tags across all identified weaknesses
  const allTags = Array.from(new Set(weaknesses.flatMap((w) => w.tags)));
  const filterSummary = weaknesses.map((w) => w.label).join(" & ");

  return {
    isRecommended: true,
    weaknesses,
    reason,
    searchTags: allTags,
    filterSummary,
  };
}
