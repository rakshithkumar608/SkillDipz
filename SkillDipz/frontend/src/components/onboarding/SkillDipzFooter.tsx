"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function SkillDipzFooter() {
  return (
    <footer className="w-full bg-[#f7f9fb] border-t border-gray-200/80 relative overflow-hidden z-20">
      {/* Subtle Glow Background */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-linear-to-b from-blue-100/40 via-blue-50/20 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-8 sm:py-12 flex flex-col w-full relative z-10">
        {/* 1. Career Journey CTA Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/80 p-6 sm:p-12 text-center mb-12 sm:mb-16 shadow-sm relative z-10 max-w-4xl mx-auto w-full">
          <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">
            Ready to build your future?
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 mb-6 sm:mb-8 font-medium">
            Learn. Build. Prove. Get Hired.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 gradient-bg text-white font-semibold text-base py-3.5 sm:py-4 px-8 rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-95 transition-all duration-200 w-full sm:w-auto"
          >
            Start My Journey
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

        {/* 2. SkillDipz Journey Sequence (6-Stage Horizontal Timeline) */}
        <div className="mb-12 sm:mb-20 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex items-start justify-between min-w-175 sm:min-w-200 relative px-2 sm:px-4">
            {/* Connecting Line */}
            <div className="absolute top-6 left-12 right-12 h-px bg-gray-200 z-0" />

            {/* Step 1: ASSESS */}
            <div className="relative z-10 flex flex-col items-center text-center w-28 sm:w-32 gap-2.5 sm:gap-3 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center text-blue-600 transition-transform group-hover:scale-110 shadow-sm">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
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
              <div>
                <span className="text-[11px] sm:text-xs font-extrabold text-blue-600 block mb-0.5">
                  01 ASSESS
                </span>
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium leading-tight">
                  Know where you stand.
                </p>
              </div>
            </div>

            {/* Step 2: DISCOVER */}
            <div className="relative z-10 flex flex-col items-center text-center w-28 sm:w-32 gap-2.5 sm:gap-3 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-gray-600 transition-transform group-hover:scale-110 shadow-xs">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-extrabold text-gray-600 block mb-0.5">
                  02 DISCOVER
                </span>
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium leading-tight">
                  Find your perfect path.
                </p>
              </div>
            </div>

            {/* Step 3: LEARN */}
            <div className="relative z-10 flex flex-col items-center text-center w-28 sm:w-32 gap-2.5 sm:gap-3 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-gray-600 transition-transform group-hover:scale-110 shadow-xs">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-extrabold text-gray-600 block mb-0.5">
                  03 LEARN
                </span>
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium leading-tight">
                  Acquire new skills.
                </p>
              </div>
            </div>

            {/* Step 4: BUILD */}
            <div className="relative z-10 flex flex-col items-center text-center w-28 sm:w-32 gap-2.5 sm:gap-3 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-gray-600 transition-transform group-hover:scale-110 shadow-xs">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-extrabold text-gray-600 block mb-0.5">
                  04 BUILD
                </span>
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium leading-tight">
                  Apply your knowledge.
                </p>
              </div>
            </div>

            {/* Step 5: PROVE */}
            <div className="relative z-10 flex flex-col items-center text-center w-28 sm:w-32 gap-2.5 sm:gap-3 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-gray-600 transition-transform group-hover:scale-110 shadow-xs">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
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
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-extrabold text-gray-600 block mb-0.5">
                  05 PROVE
                </span>
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium leading-tight">
                  Validate your expertise.
                </p>
              </div>
            </div>

            {/* Step 6: GET HIRED */}
            <div className="relative z-10 flex flex-col items-center text-center w-28 sm:w-32 gap-2.5 sm:gap-3 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white border-2 border-emerald-600 flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110 shadow-sm">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-extrabold text-emerald-600 block mb-0.5">
                  06 GET HIRED
                </span>
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium leading-tight">
                  Launch your career.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Main Navigation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 mb-12 sm:mb-16">
          {/* Brand Col */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-3.5">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/images/skilldepz.png"
                alt="SkillDipz Logo"
                width={140}
                height={42}
                className="w-32 sm:w-36 h-auto object-contain"
              />
            </Link>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Empowering the next generation of tech leaders through
              comprehensive learning and career placement.
            </p>
            <div className="flex gap-4 text-gray-500 mt-1">
              <Link href="#" className="hover:text-blue-600 transition-colors">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </Link>
              <Link href="#" className="hover:text-blue-600 transition-colors">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </Link>
              <Link href="#" className="hover:text-blue-600 transition-colors">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </Link>
            </div>
          </div>

          {/* Links Col 1: Platform */}
          <div className="col-span-1">
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 sm:mb-4">
              Platform
            </h3>
            <ul className="flex flex-col gap-2.5 text-xs sm:text-sm text-gray-600">
              <li>
                <Link
                  href="#"
                  className="hover:text-blue-600 transition-colors"
                >
                  Assess
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-blue-600 transition-colors"
                >
                  Discover
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-blue-600 transition-colors"
                >
                  Learn
                </Link>
              </li>
            </ul>
          </div>

          {/* Links Col 2: Career */}
          <div className="col-span-1">
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 sm:mb-4">
              Career
            </h3>
            <ul className="flex flex-col gap-2.5 text-xs sm:text-sm text-gray-600">
              <li>
                <Link
                  href="#"
                  className="hover:text-blue-600 transition-colors"
                >
                  Practice
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-blue-600 transition-colors"
                >
                  Build
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-blue-600 transition-colors"
                >
                  Prove
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-blue-600 transition-colors"
                >
                  Get Hired
                </Link>
              </li>
            </ul>
          </div>

          {/* Links Col 3: Company */}
          <div className="col-span-2 sm:col-span-1">
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 sm:mb-4">
              Company
            </h3>
            <ul className="flex flex-col gap-2.5 text-xs sm:text-sm text-gray-600">
              <li>
                <Link
                  href="#"
                  className="hover:text-blue-600 transition-colors"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-blue-600 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-blue-600 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* 4. Trust Strip */}
        <div className="flex flex-wrap sm:flex-nowrap justify-center md:justify-between items-center py-6 border-y border-gray-200/80 gap-4 sm:gap-6 mb-8 text-xs sm:text-sm text-gray-600 text-center">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span className="font-semibold text-gray-800">Know Your Skills</span>
          </div>
          <div className="hidden sm:block w-1.5 h-1.5 bg-gray-300 rounded-full" />
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span className="font-semibold text-gray-800">Follow Your Path</span>
          </div>
          <div className="hidden sm:block w-1.5 h-1.5 bg-gray-300 rounded-full" />
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span className="font-semibold text-gray-800">
              Become Career-Ready
            </span>
          </div>
        </div>

        {/* 5. Final Bottom Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs sm:text-sm text-gray-500 text-center sm:text-left">
          <p>© 2026 SkillDipz EdTech. All rights reserved.</p>
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6">
            <Link href="#" className="hover:text-blue-600 transition-colors">
              Privacy Policy
            </Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">
              Terms of Service
            </Link>
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
              <span>English</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
