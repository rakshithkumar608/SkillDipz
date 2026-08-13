"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function CareerReady() {
  return (
    <section className="w-full bg-[#f7f9fb] py-16 sm:py-24 px-4 sm:px-8 lg:px-16 border-t border-gray-100 relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col gap-12 sm:gap-16">
        {/* Top Header Block */}
        <div className="w-full max-w-3xl">
          <p className="text-xl sm:text-2xl font-bold text-blue-600 mb-2">
            Your goal isn&apos;t another certificate.
          </p>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight mb-4">
            It&apos;s being ready when the opportunity comes.
          </h2>
          <p className="text-base sm:text-lg text-gray-600 font-medium">
            Build skills. Prove them. Get ready.
          </p>
        </div>

        {/* Split Screen Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch w-full">
          {/* Left Side: Career Readiness Card */}
          <div className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-10 flex flex-col justify-between gap-8 shadow-sm">
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 tracking-wider uppercase mb-6 flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 15l-2 5l9-11h-7l2-5l-9 11h7z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </span>
                READY FOR THE NEXT STEP
              </h3>

              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-base font-medium text-gray-700">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                      />
                    </svg>
                  </div>
                  Skills Acquired
                </li>
                <li className="flex items-center gap-3 text-base font-medium text-gray-700">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                      />
                    </svg>
                  </div>
                  Practice Completed
                </li>
                <li className="flex items-center gap-3 text-base font-medium text-gray-700">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                      />
                    </svg>
                  </div>
                  Projects Built
                </li>
                <li className="flex items-center gap-3 text-base font-medium text-gray-700">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                      />
                    </svg>
                  </div>
                  Assessments Passed
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-semibold text-gray-800">
                    Interview Prep
                  </span>
                  <span className="text-sm font-bold text-blue-600">78%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: "78%" }}
                  />
                </div>
              </div>

              <Link
                href="/register"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 w-full text-base"
              >
                Start Your Journey
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

          {/* Right Side: Realistic Interview Photo */}
          <div className="relative min-h-90 lg:min-h-105 rounded-3xl overflow-hidden shadow-sm border border-gray-200/80">
            <img
              src="/images/img3.png"
              alt="Realistic interview setting with professionals"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}
