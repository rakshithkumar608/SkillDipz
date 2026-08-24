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
      // Tab filter
      if (activeTab !== "all" && c.approval_status !== activeTab) {
        return false;
      }
      // Search filter
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

  // Counts
  const counts = useMemo(() => {
    const pending = companies.filter((c) => c.approval_status === "pending").length;
    const approved = companies.filter((c) => c.approval_status === "approved").length;
    const rejected = companies.filter((c) => c.approval_status === "rejected").length;
    return { pending, approved, rejected, total: companies.length };
  }, [companies]);

  // Handle Approve
  const handleApprove = async (company: CompanyUser) => {
    const companyId = company.id || (company as { _id?: string })._id;
    if (!companyId) return;

    setActionLoadingId(companyId);
    try {
      await approveCompany(companyId);
      toast.success(`Approved ${company.company_name}! The company can now access the portal.`);
      // Update local state instantly
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
            Review corporate credentials, GSTIN/CIN records, and grant employer access to SkillDipz.
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
          <p className="text-[11px] text-slate-400 mt-1">Declined applications</p>
        </div>

        {/* Total Card */}
        <div
          onClick={() => setActiveTab("all")}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "all"
              ? "bg-sky-500/10 border-sky-500/40 shadow-lg shadow-sky-500/10"
              : "bg-slate-900/60 border-white/5 hover:border-white/15"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Total Registered</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3">{counts.total}</p>
          <p className="text-[11px] text-slate-400 mt-1">All organizations</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-2xl border border-white/5 backdrop-blur-md">
        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "pending", label: "Pending Approvals", count: counts.pending, color: "text-amber-400" },
            { id: "approved", label: "Approved", count: counts.approved, color: "text-emerald-400" },
            { id: "rejected", label: "Rejected", count: counts.rejected, color: "text-rose-400" },
            { id: "all", label: "All Companies", count: counts.total, color: "text-slate-400" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "bg-slate-800 text-white shadow-md border border-white/10"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/80 font-mono font-black ${
                  activeTab === tab.id ? tab.color : "text-slate-400"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search company, email, GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/70 transition-colors"
          />
        </div>
      </div>

      {/* Companies List / Table */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-xs font-semibold">Loading organization approvals…</p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/40 rounded-2xl border border-white/5 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-300">No organizations found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No companies matching "${searchQuery}" in ${activeTab} queue.`
              : `No companies currently in the ${activeTab} queue.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCompanies.map((c) => {
            const companyId = c.id || (c as { _id?: string })._id || "";
            const isPending = c.approval_status === "pending";
            const isApproved = c.approval_status === "approved";
            const isRejected = c.approval_status === "rejected";
            const isActionLoading = actionLoadingId === companyId;

            return (
              <motion.div
                key={companyId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl hover:border-white/20 transition-all space-y-4"
              >
                {/* Card Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-emerald-400 font-black text-lg shrink-0">
                      {c.company_name?.[0]?.toUpperCase() || "C"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-lg font-bold text-white tracking-tight">{c.company_name}</h2>
                        {/* Status Badge */}
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] font-bold">
                            <Clock className="w-3 h-3 animate-pulse" />
                            Pending Admin Review
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved & Verified
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-400 text-[11px] font-bold">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{c.industry || "Technology & Services"}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-500">
                          Applied: {c.created_at ? new Date(c.created_at).toLocaleDateString() : "Recent"}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Actions Header on Pending */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleApprove(c)}
                          disabled={isActionLoading}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Company</span>
                        </button>
                        <button
                          onClick={() => openRejectModal(c)}
                          disabled={isActionLoading}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold text-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}
                    {isApproved && (
                      <button
                        onClick={() => openRejectModal(c)}
                        disabled={isActionLoading}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <span>Revoke Access</span>
                      </button>
                    )}
                    {isRejected && (
                      <button
                        onClick={() => handleApprove(c)}
                        disabled={isActionLoading}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-950/40 text-slate-400 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <span>Re-Approve</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-white/5 text-xs">
                  {/* Contact Person */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Contact Person
                    </span>
                    <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.contact_name || "N/A"}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-slate-500" />
                      <span>{c.email}</span>
                    </p>
                  </div>

                  {/* GSTIN / CIN */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      GSTIN / CIN Record
                    </span>
                    <p className="font-mono font-bold text-emerald-400 text-xs flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{c.gstin_or_cin || "Not Provided"}</span>
                    </p>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {c.gstin_or_cin?.length === 15 ? "15-Digit GSTIN" : "21-Digit CIN"}
                    </span>
                  </div>

                  {/* LinkedIn & Web */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Corporate Social & Web
                    </span>
                    <div className="space-y-1">
                      {c.linkedin_company_url && (
                        <a
                          href={c.linkedin_company_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium truncate max-w-full"
                        >
                          <Globe className="w-3 h-3 shrink-0" />
                          <span className="truncate">LinkedIn Page</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      )}
                      {c.company_website && (
                        <a
                          href={c.company_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-slate-300 hover:text-white font-medium truncate max-w-full block"
                        >
                          <Globe className="w-3 h-3 shrink-0 text-slate-400" />
                          <span className="truncate">{c.company_website.replace(/^https?:\/\//, "")}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Size & Review Metadata */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Company Size & Review
                    </span>
                    <p className="text-slate-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.company_size || "11-50"} Employees</span>
                    </p>
                    {c.approval_note && (
                      <p className="text-[11px] text-rose-400 mt-1 truncate" title={c.approval_note}>
                        Note: {c.approval_note}
                      </p>
                    )}
                  </div>
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
                    This will block employer access and revoke any active sessions.
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
                  placeholder="e.g. Invalid GSTIN number or personal LinkedIn profile provided."
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
