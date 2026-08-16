import api from "./api";


export interface SkillGapItem {
    skill: string;
    current: number;
    required: number;
    gap: number;
    priority: number;
}

export interface SkillGapData {
    role: string;
    acquired_skills: string[];
    skill_gaps: SkillGapItem[];
    overall_match_pct: number;
}

export async function fetchSkillGap(): Promise<SkillGapData> {
    const {data} = await api.get<SkillGapData>("/students/me/skill-gap");
    return data;
}