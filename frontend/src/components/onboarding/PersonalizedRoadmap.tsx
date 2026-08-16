"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function PersonalizedRoadmap() {
  return (
    <section className="w-full bg-[#f7f9fb] py-16 sm:py-24 px-4 sm:px-8 lg:px-16 border-t border-gray-100 relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">
        {/* Left Column: Content (45%) */}
        <div className="w-full lg:w-[45%] flex flex-col gap-6 z-10">
          <div className="flex flex-col gap-2">
            <span className="text-xs sm:text-sm font-bold text-blue-600 tracking-widest uppercase">
              YOUR PERSONALIZED ROADMAP
            </span>
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight">
              Turn skill gaps into a clear{" "}
              <span className="text-blue-600 relative inline-block">
                roadmap.
                
              </span>
            </h2>
          </div>

          <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-lg">
            SkillDipz turns your assessment results into a simple learning path
            based on your goals and current skills.
          </p>

          <ul className="flex flex-col gap-3.5 my-2">
            <li className="flex items-center gap-3 text-base font-medium text-gray-800">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                  />
                </svg>
              </div>
              Personalized for you
            </li>
            <li className="flex items-center gap-3 text-base font-medium text-gray-800">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                  />
                </svg>
              </div>
              Focused on your skill gaps
            </li>
            <li className="flex items-center gap-3 text-base font-medium text-gray-800">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                  />
                </svg>
              </div>
              Track your progress
            </li>
          </ul>

          <div className="pt-2">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 gradient-bg text-white font-semibold text-base sm:text-[17px] px-8 py-3.5 sm:py-4 rounded-full shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-300 w-max"
            >
              Start My Roadmap
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

        {/* Right Column: Visual (55%) */}
        <div className="w-full lg:w-[55%] relative flex justify-center lg:justify-end items-center mt-6 lg:mt-0">
          {/* Main Image Container */}
          <div className="w-full max-w-135 aspect-4/3 sm:aspect-square rounded-3xl overflow-hidden shadow-2xl border border-gray-200/80 relative">
            <img
              src="/images/img2.png"
              alt="Student working on personalized roadmap"
              className="w-full h-full object-cover"
            />
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-linear-to-tr from-black/10 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Overlapping Floating UI Card */}
          <div className="absolute -bottom-10 left-2 sm:left-4 lg:-left-12 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 p-5 sm:p-6 w-[92%] max-w-85 flex flex-col gap-4 z-20">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base sm:text-lg">
                Your Roadmap
              </h3>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md">
                45% Complete
              </span>
            </div>

            {/* Interactive Steps Timeline */}
            <div className="flex flex-col relative pl-2 mt-1 gap-3.5">
              {/* Vertical connecting line */}
              <div className="absolute left-3.75 top-3 bottom-6 w-0.5 bg-gray-200 z-0" />
              <div className="absolute left-3.75 top-3 h-[42%] w-0.5 bg-blue-600 z-0" />

              {/* Step 1: Done */}
              <div className="flex gap-3 relative z-10 items-start">
                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5 text-white shadow-sm">
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
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm font-semibold text-gray-800 line-through opacity-70">
                    JavaScript Fundamentals
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    Completed
                  </span>
                </div>
              </div>

              {/* Step 2: Done */}
              <div className="flex gap-3 relative z-10 items-start">
                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5 text-white shadow-sm">
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
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm font-semibold text-gray-800 line-through opacity-70">
                    React Fundamentals
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    Completed
                  </span>
                </div>
              </div>

              {/* Step 3: In Progress */}
              <div className="flex gap-3 relative z-10 items-start">
                <div className="w-5 h-5 rounded-full border-2 border-blue-600 bg-white flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                </div>
                <div className="flex flex-col w-full">
                  <span className="text-xs sm:text-sm font-bold text-blue-600">
                    Advanced React
                  </span>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full w-[40%]" />
                  </div>
                </div>
              </div>

              {/* Step 4: Todo */}
              <div className="flex gap-3 relative z-10 items-start">
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm font-medium text-gray-500">
                    API Integration
                  </span>
                </div>
              </div>

              {/* Step 5: Todo */}
              <div className="flex gap-3 relative z-10 items-start">
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm font-medium text-gray-500">
                    Production Project
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/register"
              className="mt-1 text-xs sm:text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1 transition-all"
            >
              View Full Roadmap
              <svg
                className="w-4 h-4"
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
      </div>

      {/* Journey Indicator */}
      <div className="w-full mt-24 pt-8 border-t border-gray-100/60 flex justify-center">
        <div className="flex items-center gap-2 sm:gap-4 text-xs font-bold tracking-widest text-gray-400 uppercase flex-wrap justify-center">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-2 h-2 rounded-full bg-blue-200" /> ASSESS
          </span>
          <svg
            className="w-4 h-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 5l7 7-7 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span className="flex items-center gap-1.5 text-blue-600 font-extrabold">
            <span className="w-2 h-2 rounded-full bg-blue-600" /> ROADMAP
          </span>
          <svg
            className="w-4 h-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 5l7 7-7 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span className="flex items-center gap-1.5 opacity-60">PRACTICE</span>
          <svg
            className="w-4 h-4 text-gray-300 opacity-60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 5l7 7-7 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span className="flex items-center gap-1.5 opacity-60">BUILD</span>
          <svg
            className="w-4 h-4 text-gray-300 opacity-60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 5l7 7-7 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span className="flex items-center gap-1.5 opacity-60">CAREER</span>
        </div>
      </div>
    </section>
  );
}
