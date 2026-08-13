"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function BuildPractice() {
  return (
    <section className="w-full bg-[#f7f9fb] py-16 sm:py-24 px-4 sm:px-8 lg:px-16 border-t border-gray-100 relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto relative">
        {/* Header Section */}
        <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight mb-4">
            Don&apos;t just watch.{" "}
            <span className="text-blue-600">Build.</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-600 font-medium">
            Master skills through a hands-on learning approach.
          </p>
        </div>

        {/* Bento Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16 relative z-10">
          {/* Learn Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200/80 shadow-sm flex flex-col items-start gap-4 group hover:border-blue-600 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
              <svg
                className="w-6 h-6"
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
            <h3 className="text-xl font-bold text-gray-900">
              Courses &amp; Learning
            </h3>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
              Learn from structured resources designed by industry experts.
            </p>
          </div>

          {/* Practice Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200/80 shadow-sm flex flex-col items-start gap-4 group hover:border-blue-600 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              Practice &amp; Skill Tests
            </h3>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
              Test your knowledge through interactive coding environments.
            </p>
          </div>

          {/* Build Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200/80 shadow-sm flex flex-col items-start gap-4 md:col-span-2 lg:col-span-1 group hover:border-blue-600 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
              <svg
                className="w-6 h-6"
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
            <h3 className="text-xl font-bold text-gray-900">Real Projects</h3>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
              Demonstrate your abilities by building real-world applications.
            </p>
          </div>

          {/* Prove Card (Full width horizontal banner) */}
          <div className="gradient-bg rounded-2xl p-6 sm:p-7 shadow-md flex items-center gap-4 col-span-1 md:col-span-2 lg:col-span-3 text-white">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <svg
                className="w-6 h-6 text-white"
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
            </div>
            <div>
              <h4 className="text-sm font-extrabold tracking-wider uppercase text-white">
                PROVE
              </h4>
              <p className="text-sm sm:text-base text-white/90 font-medium mt-0.5">
                Showcase &amp; Earn credentials that matter.
              </p>
            </div>
          </div>
        </div>

        {/* Visual Journey Timeline */}
        <div className="w-full max-w-4xl mx-auto py-8 mb-12 hidden md:block">
          <div className="flex items-center justify-between relative">
            {/* Connecting Line */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-gray-200 -z-10" />

            {/* Step 1: Learn */}
            <div className="flex flex-col items-center gap-2 bg-[#f7f9fb] px-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border-2 border-[#f7f9fb] shadow-xs">
                <svg
                  className="w-5 h-5"
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
              <span className="text-xs font-bold text-gray-500 tracking-wider uppercase">
                Learn
              </span>
            </div>

            {/* Step 2: Practice */}
            <div className="flex flex-col items-center gap-2 bg-[#f7f9fb] px-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border-2 border-[#f7f9fb] shadow-xs">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <span className="text-xs font-bold text-gray-500 tracking-wider uppercase">
                Practice
              </span>
            </div>

            {/* Step 3: Test */}
            <div className="flex flex-col items-center gap-2 bg-[#f7f9fb] px-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border-2 border-[#f7f9fb] shadow-xs">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <span className="text-xs font-bold text-gray-500 tracking-wider uppercase">
                Test
              </span>
            </div>

            {/* Step 4: Build */}
            <div className="flex flex-col items-center gap-2 bg-[#f7f9fb] px-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border-2 border-[#f7f9fb] shadow-xs">
                <svg
                  className="w-5 h-5"
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
              <span className="text-xs font-bold text-gray-500 tracking-wider uppercase">
                Build
              </span>
            </div>

            {/* Step 5: Prove */}
            <div className="flex flex-col items-center gap-2 bg-[#f7f9fb] px-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white border-2 border-[#f7f9fb] shadow-md">
                <svg
                  className="w-5 h-5 text-white"
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
              </div>
              <span className="text-xs font-bold text-blue-600 tracking-wider uppercase">
                Prove
              </span>
            </div>
          </div>
        </div>

        {/* Small image detail (Bottom right) */}
        <div className="absolute -bottom-8 -right-8 w-48 h-48 hidden lg:block rounded-2xl overflow-hidden shadow-xl border-4 border-white opacity-90 hover:opacity-100 transition-opacity z-20">
          <img
            src="/images/img5.png"
            alt="Student coding on keyboard close up"
            className="w-full h-full object-cover"
          />
        </div>

        {/* CTA */}
        <div className="flex justify-center mt-12">
          <Link
            href="/register"
            className="gradient-bg text-white font-semibold text-base sm:text-[17px] py-4 px-12 rounded-xl hover:opacity-95 transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
          >
            Next Step
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
