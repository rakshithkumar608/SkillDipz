"use client";


import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { ArrowRight, BrainCircuit, Briefcase, Cloud, Database, Layers, MonitorSmartphone, Paintbrush, Server, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

const slides = [
  {
    image: "/images/slide1.jpeg",
    title: "Practice on real problems",
    subtitle: "Not tutorials. Actual coding problems scored the way companies score them."
  },

  {
    image: "/images/slide2.jpeg",
    title: "See exactly what's missing",
    subtitle: "Your roadmap is built from your resume, not a generic course list."
  },

  {
    image: "/images/slide3.jpeg",
    title: "Practice the interview, not just the code",
    subtitle: "Mock interviews graded on delivery, not just correct answers."
  },

  {
    image: "/images/slide4.jpeg",
    title: "Companies see your real score",
    subtitle: "Recruiters filter by verified skills, not a resume they can't check."
  },


  {
    image: "/images/slide5.jpeg",
    title: "Watch your score move",
    subtitle: "Every problem solved and course finished updates it in real time."
  },
];

const roles = [
  {name: "Frontend Engineer", icon: MonitorSmartphone},
  {name: "Backend Engineer", icon: Server},
  {name: "Full Stack Developer", icon: Layers},
  {name: "Data Scientist", icon: Database},
  { name: "Machine Learning", icon: BrainCircuit },
  { name: "DevOps Specialist", icon: Cloud },
  { name: "UI/UX Designer", icon: Paintbrush },
  { name: "Product Manager", icon: Briefcase }
];

function AnimatedCounter({ end, suffix = "", prefix = "" }: { end: number, suffix?: string, prefix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (end === 0) {
      setCount(0);
      return;
    }
    
    let start = 0;
    const duration = 2000;
    const increment = end / (duration / 16);

    const timer = setInterval(() =>{
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end]);

  const formattedCount = count.toLocaleString();

  return <span>{prefix}{formattedCount}{suffix}</span>;
}


export default function OnboardingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000); // Auto-slide every 5 seconds
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <main className="relative w-full min-h-screen bg-black text-white overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[14px_24px]"></div>
      <div className="absolute left-0 right-0 top-[-10%] h-[1000px] w-[1000px] rounded-full bg-[radial-gradient(circle_400px_at_50%_300px,#fbfbfb36,#000)]"></div>

      {/* Navbar */}
      <header className="relative z-20">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-8">
          <a href="/" className="flex items-center gap-3">
            <Image
              src="/images/skilldepz.png"
              alt="SkillDipz Logo"
              width={150}
              height={45}
              className="w-24 sm:w-[150px] h-auto"
              priority
            />
          </a>

          <div className="flex items-center gap-2 sm:gap-3">
            <button className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-neutral-300 transition hover:text-white whitespace-nowrap">
              Sign in
            </button>

            <HoverBorderGradient
              containerClassName="cursor-pointer"
              className="flex items-center gap-2 text-xs sm:text-sm font-medium whitespace-nowrap px-4 py-2"
            >
              Get Started <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </HoverBorderGradient>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center pt-16 sm:pt-24 px-4">
        <div className="mb-12 text-center w-full max-w-4xl">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight">
                Build a Career That Matches Your{" "}
                <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 via-purple-500 to-pink-500">
                    True Potential
                </span>
            </h1>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-neutral-300 max-w-2xl mx-auto px-4 sm:px-0">
                SkillDipz bridges the gap between your current skills and your career
                ambitions through AI-powered analysis and personalized learning paths.
            </p>

            <div className="mt-8 sm:mt-12 flex justify-center gap-4 sm:gap-6">
              <HoverBorderGradient
                containerClassName="cursor-pointer"
                className="flex items-center gap-2 text-sm sm:text-base font-medium px-6 py-3 whitespace-nowrap"
              >
                Start Your Journey <ArrowRight className="h-4 w-4" />
              </HoverBorderGradient>
            </div>
        </div>
      </section>

      {/* Slides Section */}
      <section className="relative z-10 py-16 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto relative group">
          {/* Carousel Container */}
          <div className="relative h-[400px] sm:h-[500px] w-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
              >
                {/* Background Image with Overlay */}
                <Image
                  src={slide.image}
                  alt={slide.title}
                  fill
                  className="object-cover"
                  priority={index === 0}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent"></div>
                
                {/* Text Content overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 text-center sm:text-left">
                  <h3 className="text-2xl sm:text-4xl font-bold text-white mb-4">{slide.title}</h3>
                  <p className="text-base sm:text-lg text-neutral-300 max-w-2xl">{slide.subtitle}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/50 text-white backdrop-blur-sm border border-white/10 hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/50 text-white backdrop-blur-sm border border-white/10 hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2.5 rounded-full transition-all ${
                  idx === currentSlide ? "bg-white w-8" : "bg-white/40 w-2.5 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Counting / Stats Section (Real Data integration point) */}
      <section className="relative z-10 py-16 px-4 border-y border-white/10 bg-white/5 backdrop-blur-md">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 text-center">
          <div>
            <div className="text-4xl sm:text-5xl font-bold text-white mb-2">
              {/* TODO: Fetch real active learners from API */}
              <AnimatedCounter end={0} suffix="" />
            </div>
            <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wider font-semibold">Active Learners</div>
          </div>
          <div>
            <div className="text-4xl sm:text-5xl font-bold text-white mb-2">
              {/* TODO: Fetch real problems solved from API */}
              <AnimatedCounter end={0} suffix="" />
            </div>
            <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wider font-semibold">Problems Solved</div>
          </div>
          <div>
            <div className="text-4xl sm:text-5xl font-bold text-white mb-2">
              {/* TODO: Fetch real interview success rate from API */}
              <AnimatedCounter end={0} suffix="%" />
            </div>
            <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wider font-semibold">Interview Success</div>
          </div>
          <div>
            <div className="text-4xl sm:text-5xl font-bold text-white mb-2 flex items-center justify-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" /> 24/7
            </div>
            <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wider font-semibold">AI Mentor Support</div>
          </div>
        </div>
      </section>

      {/* Roles Section (With Icons) */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Discover Your Path</h2>
          <p className="text-neutral-400 mb-12 max-w-2xl mx-auto">
            Choose a specialization and let our AI tailor a curriculum specifically designed to get you hired in these top tech roles.
          </p>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 max-w-4xl mx-auto">
            {roles.map((role, idx) => {
              const Icon = role.icon;
              return (
                <div 
                  key={idx} 
                  className="px-6 py-3 rounded-full flex items-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 transition-all cursor-pointer text-sm sm:text-base text-neutral-300 hover:text-white hover:-translate-y-1"
                >
                  <Icon className="w-4 h-4 text-purple-400" />
                  {role.name}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-4 border-t border-white/10 bg-black/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Image
              src="/images/skilldepz.png"
              alt="SkillDipz Logo"
              width={100}
              height={30}
              className="w-24 h-auto opacity-70 grayscale hover:grayscale-0 transition-all"
            />
          </div>
          <p className="text-sm text-neutral-500">© 2026 SkillDipz. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-neutral-500">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
