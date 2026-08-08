"use client";

import {
  AssessmentResult,
  AssessmentSessionData,
  AssessmentTopic,
  CFProblem,
  getActiveSession,
  getAvailableAssessments,
  getCFProfile,
  getCodingProblems,
  getMyProfile,
  startAssessment,
} from "@/lib/practiceApi";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type MainTab = "skill-tests" | "coding";
type Difficulty = "Easy" | "Medium" | "Hard";

export default function PracticePage() {
  // Profiles
  const [role, setRole] = useState<string>("backend");
  const [cfHandle, setCfHandle] = useState<string>("");
  const [cfProfileInfo, setCfProfileInfo] = useState<{
    rating: number | null;
    rank: string;
  } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Tabs
  const [mainTab, setMainTab] = useState<MainTab>("skill-tests");

  // MCQ state
  const [topics, setTopics] = useState<AssessmentTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);
  const [activeSession, setActiveSession] =
    useState<AssessmentSessionData | null>(null);
  const [sessionInitialSecs, setSessionInitialSecs] = useState<
    number | undefined
  >();
  const [sessionInitialAnswers, setSessionInitialAnswers] = useState<
    Record<string, string>
  >({});
  const [activeTopic, setActiveTopic] = useState<AssessmentTopic | null>(null);
  const [testResult, setTestResult] = useState<AssessmentResult | null>(null);

  // CF state
  const [problems, setProblems] = useState<CFProblem[]>([]);
  const [cfLoading, setCfLoading] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [cfPage, setCfPage] = useState(1);
  const [cfTotal, setCfTotal] = useState(0);
  const [verifyProblem, setVerifyProblem] = useState<CFProblem | null>(null);

  // Load profiles from backend
  useEffect(() => {
    (async () => {
      try {
        const profile = await getMyProfile();
        const rawRole = (profile.target_roles || "backend").toLowerCase();
        const normalized =
          rawRole.includes("fullstack") || rawRole.includes("full stack") ? "fullstack"
          : rawRole.includes("data") ? "data"
          : rawRole.includes("devops") ? "devops"
          : rawRole.includes("ai") || rawRole.includes("ml") ? "ai"
          : "backend";
        setRole(normalized);

        if(profile.cf_handle) {
          setCfHandle(profile.cf_handle);
          try {
            const cf = await getCFProfile(profile.cf_handle);
            setCfProfileInfo({rating: cf.rating, rank: cf.rank});
          } catch  {
            // Not found — handle still set for verify flow
          }
        }
      } catch {
        // Profile not loaded — keep defaults
      } finally {
        setProfileLoaded(true);
      }
    })();
  }, []);

  //  load topics
  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    try {
      const data = await getAvailableAssessments(role);
      setTopics(data);
    } catch (err:any) {
      toast.error(err?.response?.data?.detail || "Failed to load skill tests.");
    } finally {
      setTopicsLoading(false);
    }
  }, [role]);

  // load CF problems
  const loadProblems = useCallback(async () => {
    setCfLoading(true);
    try {
      const res = await getCodingProblems(role, difficulty, cfPage);
      setProblems(res.problems);
      setCfTotal(res.total);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to load Codeforces problems.");
    } finally {
      setCfLoading(false);
    }
  }, [role, difficulty, cfPage]);

  useEffect(() => {
    if (!profileLoaded) return;
    if (mainTab === "skill-tests") loadTopics();
    else loadProblems();
  }, [mainTab, profileLoaded]);

  useEffect(() => {
    if (!profileLoaded) return;
    if (mainTab === "coding") loadProblems();
  }, [difficulty, cfPage, profileLoaded]);

  //  Start test (with session resume check) 
  const handleStartTest = async (topic: AssessmentTopic) => {
    setStartingTopicId(topic.topic_id);
    try {
      // Check if there's an in-progress session to resume
      const resumeData = await getActiveSession(topic.topic_id);
      if (resumeData.session) {
        const s = resumeData.session;
        setActiveTopic(topic);
        setActiveSession({
          session_id: s.session_id,
          topic_title: s.topic_title,
          time_limit_mins: Math.ceil(s.seconds_remaining / 60),
          expires_at: new Date(Date.now() + s.seconds_remaining * 1000).toISOString(),
          questions: s.questions,
        });
        setSessionInitialSecs(s.seconds_remaining);
        setSessionInitialAnswers(s.answers_so_far || {});
        toast.info("Resuming your in-progress test.");
        return;
      }

      // Start fresh
      const session = await startAssessment(topic.topic_id);
      setActiveTopic(topic);
      setActiveSession(session);
      setSessionInitialSecs(undefined);
      setSessionInitialAnswers({});
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not start test.");
    } finally {
      setStartingTopicId(null);
    }
  };

  const handleTestComplete = (result: AssessmentResult) => {
    setActiveSession(null);
    setTestResult(result);
    loadTopics();
  };

   const DIFF_OPTIONS: Difficulty[] = ["Easy", "Medium", "Hard"];
}
