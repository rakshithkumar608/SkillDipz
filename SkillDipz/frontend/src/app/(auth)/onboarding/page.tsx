"use client";

import BuildPractice from "@/components/onboarding/BuildPractice";
import CareerReady from "@/components/onboarding/CareerReady";
import DiscoverSkillGaps from "@/components/onboarding/DiscoverSkillGaps";
import PersonalizedRoadmap from "@/components/onboarding/PersonalizedRoadmap";
import SkillDipzFooter from "@/components/onboarding/SkillDipzFooter";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function OnboardingPage() {
  return (
    <div className="font-sans text-gray-900 antialiased min-h-screen flex flex-col relative overflow-x-hidden bg-[#f7f9fb]">
      {/* BEGIN: Header */}
      <header className="w-full px-6 lg:px-12 py-3 lg:py-4 flex items-center justify-between absolute  left-0 right-0 z-50  -top-5 sm:-top-10 md:-top-2 lg:-top-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Image
            src="/images/skilldepz.png"
            alt="SkillDipz Logo"
            width={140}
            height={42}
            className="w-32 sm:w-36 lg:w-40 h-auto object-contain"
            priority
          />
        </Link>

        {/* Auth Buttons */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/login"
            className="text-sm sm:text-base font-semibold text-gray-700 hover:text-gray-900 transition-colors whitespace-nowrap px-2 py-1 flex items-center"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-sm sm:text-base font-semibold text-white gradient-bg px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl hover:opacity-95 transition-all shadow-md shadow-blue-500/20 whitespace-nowrap flex items-center justify-center"
          >
            Sign Up
          </Link>
        </div>
      </header>
      {/* END: Header */}

      {/* BEGIN: Main Content */}
      <main className="grow flex flex-col lg:flex-row relative pt-20 sm:pt-24 lg:pt-28 pb-16 sm:pb-24 lg:pb-32 min-h-screen lg:min-h-200">
        {/* Desktop Background Image container (Right Side) */}
        <div className="absolute inset-y-0 right-0 w-full lg:w-[55%] xl:w-[60%] z-0 hero-image-clip overflow-hidden hidden lg:block -mr-10">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: "url('/images/img1.png')",
              backgroundSize: "130% auto",
              backgroundPosition: "85% center",
              backgroundRepeat: "no-repeat",
            }}
          />
        </div>

        {/* Left Content Area */}
        <div className="w-full lg:w-[45%] flex flex-col justify-center px-4 sm:px-8 lg:pl-16 xl:pl-24 z-10 relative mt-4 sm:mt-8 lg:mt-0 max-w-xl mx-auto lg:mx-0">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-tight tracking-tight mb-4 sm:mb-6">
            <span className="text-gray-900">Your</span>{" "}
            <span className="text-blue-600">skills.</span>
            <br />
            <span className="text-gray-900">Your</span>{" "}
            <span className="text-blue-600">roadmap.</span>
            <br />
            <span className="text-gray-900">Your</span>{" "}
            <span className="text-blue-600">career.</span>
          </h1>

          <div className="w-12 sm:w-16 h-1 gradient-bg rounded-full mb-6 sm:mb-8"></div>

          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
            Stop guessing what to learn next.
          </h2>

          <p className="text-sm sm:text-base lg:text-[17px] text-gray-600 mb-6 sm:mb-10 max-w-md leading-relaxed">
            SkillDipz helps you discover your skill gaps, build the right
            skills, practice them, and prepare for real career opportunities in
            the tech industry.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-8 w-full sm:w-auto">
            <Link
              href="/register"
              className="gradient-bg text-white text-base sm:text-[17px] font-semibold px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl hover:opacity-95 transition-opacity flex items-center justify-center gap-3 shadow-lg shadow-blue-500/30 group whitespace-nowrap"
            >
              Get Started
              <svg
                className="w-5 h-5 group-hover:translate-x-1 transition-transform"
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

            <div className="flex items-center justify-center sm:justify-start gap-2 text-gray-600 text-xs sm:text-sm font-medium">
              <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center shrink-0">
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <span>
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-blue-600 hover:underline font-semibold ml-1"
                >
                  Sign in
                </Link>
              </span>
            </div>
          </div>

          {/* Mobile Hero Image Card (Visible on mobile/tablet) */}
          <div className="w-full max-w-sm mx-auto my-8 block lg:hidden">
            <div className="relative w-full h-56 sm:h-72 rounded-2xl overflow-hidden border border-white shadow-xl">
              <div
                className="w-full h-full"
                style={{
                  backgroundImage: "url('/images/img1.png')",
                  backgroundSize: "cover",
                  backgroundPosition: "right center",
                  backgroundRepeat: "no-repeat",
                }}
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent" />
            </div>
          </div>
        </div>

        {/* Right Floating Cards Area */}
        <div className="w-full lg:w-[55%] flex items-center justify-center lg:justify-start px-4 lg:pl-10 relative z-20 mt-4 lg:mt-0 lg:ml-10">
          <div className="flex flex-col relative w-full max-w-sm px-0 lg:ml-6 gap-4 sm:gap-6">
            {/* Card 1: Skill Assessment */}
            <div className="card-backdrop rounded-2xl p-4 border border-white/60 flex gap-4 items-center transform transition-transform hover:-translate-y-1 shadow-md sm:shadow-lg lg:-translate-x-12">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm sm:text-[15px]">
                  Skill Assessment
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                  Identify your strengths
                  <br className="hidden sm:inline" /> and skill gaps
                </p>
              </div>
            </div>

            {/* Card 2: Personalized Roadmap */}
            <div className="card-backdrop rounded-2xl p-4 border border-white/60 flex gap-4 items-center transform transition-transform hover:-translate-y-1 shadow-md sm:shadow-lg lg:-translate-x-20">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 text-purple-600"
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
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm sm:text-[15px]">
                  Personalized Roadmap
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                  Get a tailored learning path
                  <br className="hidden sm:inline" /> just for you
                </p>
              </div>
            </div>

            {/* Card 3: Real Projects */}
            <div className="card-backdrop rounded-2xl p-4 border border-white/60 flex gap-4 items-center transform transition-transform hover:-translate-y-1 shadow-md sm:shadow-lg lg:-translate-x-16">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 text-green-600"
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
                <h3 className="font-bold text-gray-900 text-sm sm:text-[15px]">
                  Real Projects
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                  Build industry-grade
                  <br className="hidden sm:inline" /> projects
                </p>
              </div>
            </div>

            {/* Card 4: Career Preparation */}
            <div className="card-backdrop rounded-2xl p-4 border border-white/60 flex gap-4 items-center transform transition-transform hover:-translate-y-1 shadow-md sm:shadow-lg lg:-translate-x-8">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 text-yellow-600"
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
                <h3 className="font-bold text-gray-900 text-sm sm:text-[15px]">
                  Career Preparation
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                  Prepare for interviews
                  <br className="hidden sm:inline" /> and get job-ready
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* END: Main Content */}

      {/* BEGIN: Personalized Roadmap Section */}
      <PersonalizedRoadmap />
      {/* END: Personalized Roadmap Section */}

      {/* BEGIN: Career Ready Section */}
      <CareerReady />
      {/* END: Career Ready Section */}

      {/* BEGIN: Build & Practice Section */}
      <BuildPractice />
      {/* END: Build & Practice Section */}

      {/* BEGIN: Discover Skill Gaps Section */}
      <DiscoverSkillGaps />
      {/* END: Discover Skill Gaps Section */}

      {/* BEGIN: Footer */}
      <SkillDipzFooter />
      {/* END: Footer */}
    </div>
  );
}
