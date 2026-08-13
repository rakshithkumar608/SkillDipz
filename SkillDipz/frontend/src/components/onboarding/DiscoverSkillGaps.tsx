"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function DiscoverSkillGaps() {
  return (
    <section className="w-full bg-[#f7f9fb] py-16 sm:py-24 px-4 sm:px-8 lg:px-16 border-t border-gray-100 relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col gap-12">
        {/* Header Block */}
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight mb-4">
            Know where you stand.
          </h2>
          <p className="text-base sm:text-lg text-gray-600 font-medium">
            Take skill assessments designed around the role you want to pursue.
          </p>
        </div>

        {/* Split Screen Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch w-full">
          {/* Left Side: Skill Analysis Dashboard Card */}
          <div className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col justify-between gap-6">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 tracking-wider uppercase">
                YOUR SKILL PROFILE
              </h3>
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg
                    className="w-full h-full transform -rotate-90"
                    viewBox="0 0 36 36"
                  >
                    <path
                      className="text-gray-200"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray="100, 100"
                      strokeWidth="3.5"
                    />
                    <path
                      className="text-blue-600"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray="65, 100"
                      strokeWidth="3.5"
                    />
                  </svg>
                  <span className="absolute text-xs font-bold text-blue-600">
                    65
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
                    Overall
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-gray-900">
                    Good Progress
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-5 my-1">
              {/* Progress Item 1 */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-mono text-sm font-bold">
                      &lt;/&gt;
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-800">
                      Frontend Dev
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-gray-600">
                    82%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-700"
                    style={{ width: "82%" }}
                  />
                </div>
              </div>

              {/* Progress Item 2 */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-mono text-sm font-bold">
                      &lt;/&gt;
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-800">
                      React
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-gray-600">
                    76%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-700"
                    style={{ width: "76%" }}
                  />
                </div>
              </div>

              {/* Progress Item 3 */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-mono text-sm font-bold">
                      &lt;/&gt;
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-800">
                      JavaScript
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-gray-600">
                    68%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-700"
                    style={{ width: "68%" }}
                  />
                </div>
              </div>

              {/* Progress Item 4 (Gap) */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                    <span className="text-xs sm:text-sm font-semibold text-gray-800">
                      System Design
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-bold">
                      Gap
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-600">
                      42%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-700"
                    style={{ width: "42%" }}
                  />
                </div>
              </div>

              {/* Progress Item 5 (Gap) */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                    <span className="text-xs sm:text-sm font-semibold text-gray-800">
                      Testing
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-bold">
                      Gap
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-600">
                      51%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-700"
                    style={{ width: "51%" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Image and Message */}
          <div className="relative rounded-3xl overflow-hidden min-h-95 lg:min-h-105 shadow-sm border border-gray-200/80">
            <img
              src="/images/screen.png"
              alt="Student working on laptop discovering skill gaps"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

            <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-md border border-gray-100 rounded-2xl p-5 shadow-xl flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <p className="text-sm sm:text-base font-bold text-gray-900 leading-snug">
                Don&apos;t learn everything. Learn what you&apos;re missing.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-4 text-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 gradient-bg text-white font-semibold text-base py-4 px-10 rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-300 w-full sm:w-auto"
          >
            View My Skill Gaps
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M14 5l7 7m0 0l-7 7m7-7H3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
