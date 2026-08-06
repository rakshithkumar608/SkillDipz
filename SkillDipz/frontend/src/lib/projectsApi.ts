import api from "./api";

export interface ProjectResource {
  name: string;
  url: string;
}

export interface MySubmission {
  github_url: string;
  demo_url?: string;
  submitted_at: string;
  nlp_score: number | null;
  evaluation_status: string;
}

export interface ProjectCard {
  project_id: string;
  company_name: string;
  company_logo_emoji: string | null;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  deadline_days: number;
  required_skills: string[];
  deliverables: string[];
  resources: ProjectResource[];
  status: "available" | "submitted" | "evaluated";
  my_submission: MySubmission | null;
}

export interface CommunitySubmission {
  submission_id: string;
  project_id: string;
  project_title: string;
  company_name: string;
  student_id: string;
  student_name: string;
  github_url: string;
  demo_url: string | null;
  notes: string | null;
  nlp_score: number | null;
  verified_skills: string[];
  is_group: boolean;
  group_name: string | null;
  submitted_at: string;
  comment_count: number;
}


export interface Comment {
    comment_id: string;
    author_id: string;
    author_name: string;
    body: string;
    created_at: string;
}

export interface SubmitProjectPayload {
  github_url: string;
  demo_url?: string;
  notes?: string;
  is_public?: boolean;
  group_id?: string;
}

export const getMyProjects = async (): Promise<ProjectCard[]> => {
  const { data } = await api.get<ProjectCard[]>("/projects/me");
  return data;
};

export const submitProject = async (
  projectId: string,
  payload: SubmitProjectPayload
): Promise<{ message: string; submission_id: string }> => {
  const { data } = await api.post(`/projects/${projectId}/submit`, payload);
  return data;
};

export const getCommunityFeed = async (page = 1, limit = 20): Promise<CommunitySubmission[]> => {
  const { data } = await api.get<CommunitySubmission[]>(`/projects/community?page=${page}&limit=${limit}`);
  return data;
};

export const getComments = async (submissionId: string): Promise<Comment[]> => {
  const { data } = await api.get<Comment[]>(`/projects/sub/submissions/${submissionId}/comments`);
  return data;
};

export const addComment = async (submissionId: string, body: string): Promise<{ message: string; comment_id: string }> => {
  const { data } = await api.post(`/projects/sub/submissions/${submissionId}/comments`, { body });
  return data;
};

export const createGroup = async (payload: { project_id: string; group_name: string }): Promise<{ invite_code: string }> => {
  const { data } = await api.post("/projects/groups/create", payload);
  return data;
};

export const joinGroup = async (inviteCode: string): Promise<{ message: string }> => {
  const { data } = await api.post("/projects/groups/join", { invite_code: inviteCode });
  return data;
};