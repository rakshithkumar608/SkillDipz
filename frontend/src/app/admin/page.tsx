"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Building2,
  User,
  Mail,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  ExternalLink,
  Globe,
  Users,
  Briefcase,
  AlertCircle,
  Check,
  X,
  FileText,
  Building,
} from "lucide-react";
import { getAllCompanies, approveCompany, rejectCompany, CompanyUser } from "@/lib/companyAuth";

export default function AdminCompaniesDashboardPage() {
  const [companies, setCompanies] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedCompanyForReject, setSelectedCompanyForReject] = useState<CompanyUser | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Fetch Companies
  const fetchCompanies = async () => {
    try {
      setRefreshing(true);
      const data = await getAllCompanies("all");
      setCompanies(data);
    } catch (err: unknown) {
      console.error("Failed to fetch companies:", err);
      toast.error("Failed to load company approvals list.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  // Filtered Companies
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (activeTab !== "all" && c.approval_status !== activeTab) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = c.company_name?.toLowerCase().includes(q);
        const contactMatch = c.contact_name?.toLowerCase().includes(q);
        const emailMatch = c.email?.toLowerCase().includes(q);
        const gstinMatch = c.gstin_or_cin?.toLowerCase().includes(q);
        const industryMatch = c.industry?.toLowerCase().includes(q);
        return nameMatch || contactMatch || emailMatch || gstinMatch || industryMatch;
      }
      return true;
    });
  }, [companies, activeTab, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: companies.length,
      pending: companies.filter((c) => c.approval_status === "pending").length,
      approved: companies.filter((c) => c.approval_status === "approved").length,
      rejected: companies.filter((c) => c.approval_status === "rejected").length,
    };
  }, [companies]);

  // Handle Approve
  const handleApprove = async (company: CompanyUser) => {
    const companyId = company.id || (company as { _id?: string })._id;
    if (!companyId) return;

    setActionLoadingId(companyId);
    try {
      await approveCompany(companyId);
      toast.success(`Approved ${company.company_name} for recruitment access!`);
      setCompanies((prev) =>
        prev.map((c) =>
          (c.id === companyId || (c as { _id?: string })._id === companyId)
            ? { ...c, approval_status: "approved", email_verified: true }
            : c
        )
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to approve company.";
      toast.error(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Reject Modal
  const openRejectModal = (company: CompanyUser) => {
    setSelectedCompanyForReject(company);
    setRejectReason("Document verification failed or non-corporate domain.");
    setRejectModalOpen(true);
  };

  // Confirm Reject
  const handleConfirmReject = async () => {
    if (!selectedCompanyForReject) return;
    const companyId = selectedCompanyForReject.id || (selectedCompanyForReject as { _id?: string })._id;
    if (!companyId) return;

    setActionLoadingId(companyId);
    try {
      await rejectCompany(companyId, rejectReason.trim());
      toast.error(`Rejected ${selectedCompanyForReject.company_name}.`);
      setCompanies((prev) =>
        prev.map((c) =>
          (c.id === companyId || (c as { _id?: string })._id === companyId)
            ? { ...c, approval_status: "rejected", approval_note: rejectReason.trim() }
            : c
        )
      );
      setRejectModalOpen(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to reject company.";
      toast.error(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            <span>Employer Approvals Pipeline</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Company Verification & Approval Queue
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Review corporate credentials, GSTIN/CIN records, and grant employer recruitment access to SkillDipz.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCompanies}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 hover:border-white/25 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Card */}
        <div
          onClick={() => setActiveTab("pending")}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "pending"
              ? "bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10"
              : "bg-slate-900/60 border-white/5 hover:border-white/15"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Pending Review</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3">{counts.pending}</p>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting admin review</p>
        </div>

        {/* Approved Card */}
        <div
          onClick={() => setActiveTab("approved")}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "approved"
              ? "bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10"
              : "bg-slate-900/60 border-white/5 hover:border-white/15"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Approved</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3">{counts.approved}</p>
          <p className="text-[11px] text-slate-400 mt-1">Active platform employers</p>
        </div>

        {/* Rejected Card */}
        <div
          onClick={() => setActiveTab("rejected")}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "rejected"
              ? "bg-rose-500/10 border-rose-500/40 shadow-lg shadow-rose-500/10"
              : "bg-slate-900/60 border-white/5 hover:border-white/15"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Rejected</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3">{counts.rejected}</p>
          <p className="text-[11px] text-slate-400 mt-1">Denied applications</p>
        </div>

        {/* All Card */}
        <div
          onClick={() => setActiveTab("all")}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "all"
              ? "bg-sky-500/10 border-sky-500/40 shadow-lg shadow-sky-500/10"
              : "bg-slate-900/60 border-white/5 hover:border-white/15"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Total Applicants</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3">{counts.all}</p>
          <p className="text-[11px] text-slate-400 mt-1">Cumulative records</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 w-fit">
          {(["pending", "approved", "rejected", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition ${
                activeTab === tab
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab} ({counts[tab]})
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by company, contact, email, GSTIN..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {/* Companies List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs text-slate-400">Loading company records from database...</p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="p-16 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3 max-w-xl mx-auto shadow-2xl">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No companies found.</h3>
          <p className="text-xs text-slate-400">There are no employer applications matching the selected criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCompanies.map((company) => {
            const companyId = company.id || (company as { _id?: string })._id;
            const isPending = company.approval_status === "pending";
            const isApproved = company.approval_status === "approved";
            const isRejected = company.approval_status === "rejected";

            return (
              <motion.div
                key={companyId}
                layout
                className="p-6 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-emerald-500/30 transition shadow-xl backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-white truncate">{company.company_name}</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                        isApproved
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : isRejected
                          ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-300 border-amber-500/20 animate-pulse"
                      }`}
                    >
                      {company.approval_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-400">
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span>{company.email}</span>
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                      <span>{company.industry || "Technology & Software"}</span>
                    </p>
                    {company.gstin_or_cin && (
                      <p className="flex items-center gap-1.5 truncate">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>GSTIN/CIN: {company.gstin_or_cin}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {isPending && (
                    <>
                      <button
                        onClick={() => handleApprove(company)}
                        disabled={actionLoadingId === companyId}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Access</span>
                      </button>
                      <button
                        onClick={() => openRejectModal(company)}
                        disabled={actionLoadingId === companyId}
                        className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                  {isApproved && (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Active Employer
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectModalOpen && selectedCompanyForReject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Reject {selectedCompanyForReject.company_name}?
                  </h3>
                  <p className="text-xs text-slate-400">
                    This will block employer access and revoke any active recruitment sessions.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Rejection Reason / Note:
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  placeholder="e.g. Invalid GSTIN number or non-corporate email provided."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={Boolean(actionLoadingId)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
