import { CandidateDetail, CompanyDashboard } from "@/store/companyStore";
import api from "./api";

// GET/v1/companies/me/dashboard

export async function fetchCompanyDashboard(limit = 10):Promise<CompanyDashboard> {
    const {data} = await api.get<CompanyDashboard>("/companies/me/dashboard", {
        params: {limit},
    });
    return data;
}

//  GET/v1/companies/me/candidates/{student_id}

export async function fetchCandidateDetail(student_id:string):Promise<CandidateDetail> {
    const {data} = await api.get<CandidateDetail>(
        `/companies/me/candidates/${student_id}`
    );
    return data;
}