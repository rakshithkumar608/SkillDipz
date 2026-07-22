import api from "./api";

export interface CompletenessField {
    label: string;
    weight: number;
    done: boolean;
    action: string | null;
}

export interface Certificate {
    cert_id: string;
    role: string;
    score: number;
    issued_at: string;
    pdf_url: string | null;
}

export interface EnrolledCourse {
    course_id: string;
    title: string;
    progress_pct: number;
    source: "marketplace" | "company" | "youtube" | "other";
}

export interface ScoreBreakdown {
    coding: number;
    conceptual: number;
    learning: number;
    project: number;
    profile: number;
}

export interface ProfileData {
  student_id: string;
  name: string;
  email: string;
  phone: string | null;
  college: string | null;
  branch: string | null;
  grad_year: number | null;
  avatar_url: string | null;
  github: string | null;
  linkedin: string | null;
  cf_handle: string | null;
  target_role: string | null;
  target_company: string | null;
  skills: string[];
  visibility_setting: string;
  resume_uploaded: boolean;
  resume_url: string | null;      // /students/me/resume/download
  resume_parsed_at: string | null;
  resume_parse_summary: string | null;
  certificates: Certificate[];
  enrolled_courses: EnrolledCourse[];
  score_breakdown: ScoreBreakdown;
  completeness_score: number;     // 0–10
  completeness_pct: number;       // 0–100
  completeness_fields: CompletenessField[];
}

export interface ResumeAnalysisResult {
  message: string;
  file_name: string;
  resume_uploaded: boolean;
  skills_extracted: string[];
  parse_summary: string;
  completeness_pct: number;
}

export interface PhotoUploadResult {
  message: string;
  avatar_url: string;
  completeness_pct: number;
}

export interface ProfileUpdatePayload {
  name?: string;
  phone?: string;
  college?: string;
  branch?: string;
  grad_year?: number;
  github?: string;
  linkedin?: string;
  cf_handle?: string;
  target_role?: string;
  target_company?: string;
  visibility_setting?: string;
}

export async function fetchProfile(): Promise<ProfileData> {
    const {data} = await api.get<ProfileData>("/students/me/profile");
    return data;
}

export async function updateProfile(
  payload: ProfileUpdatePayload
): Promise<ProfileData> {
  const { data } = await api.put<ProfileData>("/students/me/profile", payload);
  return data;
}

export async function uploadResume(file:File): Promise<ResumeAnalysisResult> {
    const form = new FormData();
    form.append("file",file);

    const {data} = await api.post<ResumeAnalysisResult>("/students/me/resume/upload",form,{headers:{"Content-Type":"multipart/form-data"}});
    return data;
}

export async function uploadProfilePhoto(
  file: File
): Promise<PhotoUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.put<PhotoUploadResult>(
    "/students/me/profile/photo",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

/** Returns the full absolute resume download URL */
export function getResumeDownloadUrl(baseUrl: string): string {
  return `${baseUrl}/students/me/resume/download`;
}

/** Returns the certificate PDF download URL */
export function getCertPdfUrl(certId: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}/students/me/certificates/${certId}/pdf`;
}