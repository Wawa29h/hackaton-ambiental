"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Waves, Satellite, Fish, AlertTriangle, Menu, X, ChevronDown, Youtube, Instagram } from "lucide-react"
import { AnimatedText } from "@/components/animated-text"

function AnimatedCounter({ value }: { value: string }) {
  const [displayValue, setDisplayValue] = useState("0")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const numericStr = value.replace(/[^0-9.]/g, "")
          const targetNum = parseFloat(numericStr)
          const unit = value.replace(/[0-9.]/g, "")
          let current = 0
          const increment = targetNum / 60
          const interval = setInterval(() => {
            current += increment
            if (current >= targetNum) {
              setDisplayValue(`${targetNum}${unit}`)
              clearInterval(interval)
            } else {
              setDisplayValue(`${current.toFixed(1)}${unit}`.replace(".0", ""))
            }
          }, 16)
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value])

  return <div className="text-8xl font-serif font-medium" ref={ref}>{displayValue}</div>
}

const REEF_ZONES = [
  { id: "belize",      name: "Hol Chan",        country: "Belize 🇧🇿",      lat: 17.025, lng: -88.075, color: "#06b6d4" },
  { id: "honduras",    name: "Cordelia Banks",   country: "Honduras 🇭🇳",    lat: 16.32,  lng: -86.535, color: "#34d399" },
  { id: "nicaragua",   name: "Cayos Miskitos",   country: "Nicaragua 🇳🇮",   lat: 14.38,  lng: -82.78,  color: "#22d3ee" },
  { id: "mexico",      name: "Banco Chinchorro", country: "México 🇲🇽",      lat: 18.75,  lng: -87.34,  color: "#38bdf8" },
  { id: "el_salvador", name: "Los Cóbanos",      country: "El Salvador 🇸🇻", lat: 13.524, lng: -89.807, color: "#06b6d4" },
]

export default function LandingPage() {
  const router = useRouter()
  const [isLoaded, setIsLoaded]               = useState(false)
  const [isMenuOpen, setIsMenuOpen]           = useState(false)
  const [scrollY, setScrollY]                 = useState(0)
  const [selectedFeature, setSelectedFeature] = useState(0)
  const [imageFade, setImageFade]             = useState(true)
  const [autoRotationKey, setAutoRotationKey] = useState(0)
  const [dynamicWordIndex, setDynamicWordIndex] = useState(0)
  const [wordFade, setWordFade]               = useState(true)
  const [dashboardScrollOffset, setDashboardScrollOffset] = useState(0)
  const [openFaqIndex, setOpenFaqIndex]       = useState<number | null>(null)
  const dashboardRef = useRef<HTMLDivElement>(null)
  const heroRef      = useRef<HTMLDivElement>(null)
  const observerRef  = useRef<IntersectionObserver | null>(null)

  const dynamicWords = ["corals", "reefs", "oceans", "fish", "ecosystems", "biodiversity", "marine life"]

  useEffect(() => {
    const interval = setInterval(() => {
      setWordFade(false)
      setTimeout(() => { setDynamicWordIndex(p => (p + 1) % dynamicWords.length); setWordFade(true) }, 300)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
      if (dashboardRef.current) {
        const rect = dashboardRef.current.getBoundingClientRect()
        const vh = window.innerHeight
        const start = vh * 0.8, end = vh * 0.2
        if (rect.top >= start) setDashboardScrollOffset(0)
        else if (rect.top <= end) setDashboardScrollOffset(15)
        else setDashboardScrollOffset(((start - rect.top) / (start - end)) * 15)
      }
    }
    handleScroll()
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    setIsLoaded(true)
    observerRef.current = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("animate-in") }),
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    )
    document.querySelectorAll(".animate-on-scroll").forEach(el => observerRef.current?.observe(el))
    return () => observerRef.current?.disconnect()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setImageFade(false)
      setTimeout(() => { setSelectedFeature(p => (p + 1) % 4); setImageFade(true) }, 300)
    }, 6000)
    return () => clearInterval(interval)
  }, [autoRotationKey])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
    setIsMenuOpen(false)
  }

  const features = [
    { title: "Satellite Monitoring",  desc: "24/7 NOAA satellite surveillance of sea surface temperature and thermal stress", icon: Satellite,     image: "/real-time-satellite.png" },
    { title: "DHW Tracking",          desc: "Degree Heating Weeks — the leading predictor of coral bleaching events",         icon: Waves,          image: "/biodiversity-tracking.png" },
    { title: "Species Protection",    desc: "Track indicator species: Carey Turtles, Nassau Grouper, Spiny Lobster",          icon: Fish,           image: "/drone.png" },
    { title: "Bleaching Alerts",      desc: "AI-powered alerts to fishing communities before bleaching events escalate",       icon: AlertTriangle,  image: "/deforestation-detect.png" },
  ]

  return (
    <div className="relative min-h-screen bg-[#0B0C0F] text-[#F2F3F5] overflow-x-hidden">

      {/* ── NAV ── */}
      <header className="fixed top-6 left-6 z-40 border border-white/10 backdrop-blur-md bg-[#0B0C0F]/80 rounded-[16px]">
        <div className="px-6">
          <div className="flex items-center gap-6 h-14">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="text-lg font-semibold font-mono hover:text-cyan-400 transition-colors duration-300"
            >
              CORAL WATCH
            </button>
            <nav className="hidden md:flex items-center gap-8">
              {[["metrics","Impact"],["map","Reefs"],["tech","Technology"],["faq","FAQ"],["cta","Join us"]].map(([id, label]) => (
                <button key={id} onClick={() => scrollTo(id)}
                  className="text-sm text-[#A7ABB3] hover:text-[#F2F3F5] transition-colors duration-300">
                  {label}
                </button>
              ))}
            </nav>
            <button
              onClick={() => router.push("/dashboard")}
              className="hidden md:block ml-2 px-4 py-2 rounded-full text-xs font-medium border border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10 transition-all duration-300"
            >
              Launch Dashboard →
            </button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden ml-auto p-2 hover:bg-white/5 rounded-lg transition-colors">
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── MOBILE MENU ── */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-[#0B0C0F]/95 backdrop-blur-md z-50 flex flex-col items-start justify-end pb-20 pt-20 px-6">
          <div className="flex flex-col gap-8 items-start w-full">
            {[["metrics","Impact"],["map","Reefs"],["tech","Technology"],["faq","FAQ"],["cta","Join us"]].map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="font-serif text-5xl font-light text-[#F2F3F5] hover:text-cyan-400 transition-colors">
                {label}
              </button>
            ))}
            <button onClick={() => router.push("/dashboard")}
              className="font-serif text-5xl font-light text-cyan-400">
              Dashboard →
            </button>
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className={`relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 md:pt-32 md:pb-24 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${isLoaded ? "scale-100 opacity-100" : "scale-[1.03] opacity-0"}`}
        style={{ backgroundImage: "url('/hero-landscape.png')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{ transform: `translateY(${scrollY * 0.5}px)`, backgroundImage: "url('/hero-landscape.png')", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C0F] via-[#0B0C0F]/70 to-transparent pointer-events-none" />

        <div className="max-w-[1120px] w-full mx-auto relative z-10" style={{ transform: `translateY(${scrollY * 0.2}px)` }}>
          <div className="text-center mb-8 md:mb-12">
            <h1 className="font-serif text-[44px] leading-[1.1] md:text-[72px] md:leading-[1.05] font-medium mb-6">
              <span className={`block stagger-reveal text-7xl font-light transition-all duration-500 md:text-8xl ${wordFade ? "opacity-100 blur-0" : "opacity-0 blur-lg"}`}>
                Protect <AnimatedText key={dynamicWordIndex} text={dynamicWords[dynamicWordIndex]} delay={0} />
              </span>
              <span className="block stagger-reveal text-7xl font-light md:text-8xl" style={{ animationDelay: "90ms" }}>
                at scale
              </span>
            </h1>
            <p className="text-[#A7ABB3] text-base md:text-lg max-w-[520px] mx-auto mb-8 leading-relaxed stagger-reveal"
              style={{ animationDelay: "180ms" }}>
              Real-time coral reef monitoring with AI. Detect bleaching threats, track thermal stress, protect the Mesoamerican Reef for future generations.
            </p>
            <div className="stagger-reveal flex gap-4 justify-center flex-wrap" style={{ animationDelay: "270ms" }}>
              <Button
                onClick={() => router.push("/dashboard")}
                className="px-8 py-6 text-base rounded-full bg-cyan-500/10 border border-cyan-400/30 hover:bg-cyan-400/20 hover:border-cyan-400/60 transition-all duration-300 text-cyan-300 font-medium"
              >
                Launch Dashboard
              </Button>
              <Button
                onClick={() => scrollTo("metrics")}
                className="px-8 py-6 text-base rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-white"
              >
                Learn More
              </Button>
            </div>
          </div>

          <div className="mt-12 md:mt-20 stagger-reveal" style={{ animationDelay: "360ms" }} ref={dashboardRef}>
            <div style={{ perspective: "1200px" }}>
              <div
                className="relative aspect-[16/10] md:aspect-[16/9] rounded-[24px] overflow-hidden border border-white/10"
                style={{ transform: `rotateX(${dashboardScrollOffset}deg)`, transformStyle: "preserve-3d", transition: "transform 0.05s linear" }}
              >
                <img src="/dashboard-screenshot.png" alt="Coral Watch Dashboard" className="object-cover dashboard-image w-full h-auto" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C0F]/40 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGO MARQUEE ── */}
      <section className="relative py-12 border-y border-white/5 bg-[#0B0C0F] overflow-hidden">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-[#A7ABB3] mb-8">
          Powered by open science — data from
        </p>
        <div className="logo-marquee">
          <div className="logo-marquee-content">
            {[...Array(2)].flatMap(() => [
              "/logos/frame-11.png","/logos/frame-55.png","/logos/frame-4.png",
              "/logos/frame-6.png","/logos/frame-8.png","/logos/frame-2.png",
              "/logos/frame-3.png","/logos/frame-7.png",
            ]).map((logo, i) => (
              <div key={i} className="px-8 md:px-12 flex items-center justify-center flex-shrink-0">
                <img src={logo} alt="" className="h-20 md:h-16 w-auto object-contain brightness-0 invert" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── METRICS ── */}
      <section id="metrics" className="relative py-20 md:py-32 px-4 animate-on-scroll">
        <div className="max-w-[1120px] w-full mx-auto">
          <h2 className="font-serif text-[32px] md:text-[48px] font-medium mb-6 text-center">
            Reef Health{" "}
            <span style={{ background: "linear-gradient(135deg, #06b6d4 0%, #34d399 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Monitoring
            </span>{" "}
            at Scale
          </h2>
          <p className="text-[#A7ABB3] text-sm md:text-base mb-12 text-center max-w-[600px] mx-auto leading-relaxed">
            Tracking the Mesoamerican Reef in real-time. Powered by NOAA satellites and Copernicus Marine data.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 max-w-[800px] mx-auto">
            {[
              { label: "KM OF REEF MONITORED", value: "1K+",  desc: "Mesoamerican Reef system", color: "teal"    },
              { label: "SPECIES TRACKED",       value: "120+", desc: "indicator species",         color: "emerald" },
              { label: "DAILY DATA POINTS",     value: "2.4K", desc: "NOAA ERDDAP direct",        color: "teal"    },
              { label: "BLEACHING ACCURACY",    value: "99%",  desc: "DHW prediction rate",       color: "emerald" },
            ].map((m, i) => (
              <div key={i} className="p-6 md:p-10 text-center border-b border-white/10">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[#A7ABB3] mb-4 flex items-center justify-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${m.color === "teal" ? "bg-cyan-400/60" : "bg-emerald-400/60"}`} />
                  {m.label}
                </div>
                <AnimatedCounter value={m.value} />
                <div className="text-xs text-[#A7ABB3] mt-3">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REEF ZONES ── */}
      <section id="map" className="relative py-20 md:py-32 animate-on-scroll bg-[#0B0C0F]">
        <div className="text-center mb-12 px-4">
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#A7ABB3] mb-6 flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            MESOAMERICAN REEF SYSTEM
          </div>
          <h2 className="font-serif text-[32px] md:text-[48px] font-medium mb-6">
            Active Monitoring Zones
          </h2>
          <p className="text-[#A7ABB3] text-sm md:text-base max-w-[600px] mx-auto leading-relaxed">
            The second largest coral reef in the world — 1,000 km across four countries
          </p>
        </div>
        <div className="max-w-[1120px] mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {REEF_ZONES.map((zone) => (
              <div key={zone.id}
                className="p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:border-cyan-400/30 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group"
                onClick={() => router.push("/dashboard")}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: zone.color }} />
                  <span className="text-xs text-[#A7ABB3]">{zone.country}</span>
                </div>
                <div className="font-medium text-sm mb-1">{zone.name}</div>
                <div className="text-xs text-[#A7ABB3]">{zone.lat.toFixed(2)}°N, {Math.abs(zone.lng).toFixed(2)}°W</div>
                <div className="mt-3 text-xs text-cyan-400/60 group-hover:text-cyan-400 transition-colors">View live data →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECHNOLOGY ── */}
      <section id="tech" className="relative py-20 md:py-32 px-4 animate-on-scroll">
        <div className="max-w-[1120px] w-full mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-stretch">
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-[#A7ABB3] mb-6 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                CONSERVATION TECHNOLOGY
              </div>
              <h2 className="font-serif text-[36px] md:text-[56px] font-medium mb-8">
                Every reef{" "}
                <span style={{ background: "linear-gradient(135deg, #06b6d4 0%, #34d399 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  matters
                </span>
              </h2>
              <p className="text-[#A7ABB3] text-base md:text-lg leading-relaxed mb-12">
                Our satellite and AI technology monitors sea surface temperature, tracks Degree Heating Weeks accumulation, and alerts fishing communities in real-time. Reef protection at the speed nature demands.
              </p>

              <div className="md:hidden mb-8">
                <img
                  src={features[selectedFeature]?.image}
                  alt="Feature"
                  className={`w-full rounded-[20px] aspect-square object-cover transition-opacity duration-300 ${imageFade ? "opacity-100" : "opacity-0"}`}
                />
              </div>

              <div className="space-y-4">
                {features.map((f, i) => (
                  <button key={i}
                    onClick={() => { setImageFade(false); setTimeout(() => { setSelectedFeature(i); setImageFade(true); setAutoRotationKey(p => p + 1) }, 300) }}
                    className={`relative w-full text-left flex gap-4 items-start p-5 rounded transition-all duration-300 overflow-hidden ${selectedFeature === i ? "border border-white/20" : "border border-white/10"}`}
                  >
                    <f.icon className={`w-6 h-6 flex-shrink-0 mt-1 transition-colors ${selectedFeature === i ? "text-cyan-400" : "text-cyan-500/40"}`} />
                    <div className="flex-1">
                      <h3 className="text-base font-medium mb-1">{f.title}</h3>
                      <p className="text-sm text-[#A7ABB3]">{f.desc}</p>
                    </div>
                    {selectedFeature === i && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10">
                        <div className="h-full bg-cyan-400 progress-bar" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden md:flex items-stretch justify-center">
              <div className="relative w-full h-full min-h-[500px]">
                {features.map((f, i) => {
                  const pos = (i - selectedFeature + 4) % 4
                  return (
                    <div key={i} className="absolute inset-0 p-1 transition-all duration-500 ease-out"
                      style={{ zIndex: 4 - pos, transform: `translateX(${pos * 16}px) scale(${1 - pos * 0.02})`, opacity: pos === 0 ? 1 : 0.6 - pos * 0.15 }}>
                      <img src={f.image} alt={f.title} className="w-full h-full object-cover rounded-[20px]" />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="relative py-20 md:py-32 px-4 animate-on-scroll">
        <div className="max-w-[800px] w-full mx-auto">
          <div className="text-center mb-12">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#A7ABB3] mb-6 flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              FREQUENTLY ASKED QUESTIONS
            </div>
            <h2 className="font-serif text-[32px] md:text-[48px] font-medium mb-6">
              Got{" "}
              <span style={{ background: "linear-gradient(135deg, #06b6d4 0%, #34d399 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                questions
              </span>
              ?
            </h2>
          </div>
          <div className="space-y-4">
            {[
              { q: "What is DHW and why does it matter?",             a: "Degree Heating Weeks (DHW) measure accumulated thermal stress on coral. Above 4 DHW corals begin to bleach; above 8, mass bleaching and mortality occur. We track DHW in real-time via NOAA satellite data — no API key, direct from ERDDAP." },
              { q: "Where does the data come from?",                  a: "Reef health data comes directly from NOAA Coral Reef Watch via ERDDAP. Ocean data (temperature, currents, salinity) from Copernicus Marine Service. Wind from Open-Meteo. AI predictions from Claude via OpenRouter." },
              { q: "How does the dynamic fishing ban (veda) work?",   a: "The system uses DHW as a traffic light: green (< 1) full fishing, yellow (1–4) moderate, orange (4–8) deep-water only, red (> 8) full ban. Zones rotate daily so no area is over-fished two consecutive days." },
              { q: "How are safe fishing coordinates calculated?",     a: "Fishing zones are placed on the leeward (sotavento) side of the reef, calculated by offsetting reef coordinates opposite to wind direction. This is where fish aggregate naturally." },
              { q: "Can I access the raw API?",                       a: "Yes. The backend is fully public at hackaton-ambiental-production.up.railway.app/docs with Swagger documentation. All endpoints return real-time JSON data." },
            ].map((faq, i) => (
              <div key={i} className="border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all duration-300">
                <button onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left">
                  <span className="text-base font-medium pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 flex-shrink-0 text-[#A7ABB3] transition-transform duration-300 ${openFaqIndex === i ? "rotate-180" : ""}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaqIndex === i ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
                  <p className="px-6 pb-6 text-sm text-[#A7ABB3] leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="cta" className="relative py-24 md:py-40 px-4 animate-on-scroll overflow-hidden pt-0"
        style={{ backgroundImage: "url('/earth-cta.png')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0C0F] via-[#0B0C0F]/60 to-transparent pointer-events-none" />
        <div className="max-w-[800px] w-full mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs text-[#A7ABB3] border border-white/10 bg-black/30 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Protect the reef
          </div>
          <h2 className="font-serif text-[40px] md:text-[64px] font-medium mb-6">
            Join the reef conservation movement
          </h2>
          <p className="text-[#A7ABB3] text-base md:text-lg mb-10 leading-relaxed max-w-[560px] mx-auto">
            Together, we&apos;re protecting the Mesoamerican Reef — the lungs of the Caribbean Sea. Start monitoring today.
          </p>
          <Button
            onClick={() => router.push("/dashboard")}
            className="px-8 py-6 text-base rounded-full bg-cyan-500/10 border border-cyan-400/40 hover:bg-cyan-400/20 hover:border-cyan-400 transition-all duration-300 text-cyan-300"
          >
            Open Live Dashboard
          </Button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative px-4 border-t border-white/5 py-8">
        <div className="max-w-[1120px] w-full mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-12">
            <div className="flex flex-col gap-4">
              <div className="text-lg font-semibold font-mono text-cyan-400">CORAL WATCH</div>
              <p className="text-xs text-[#A7ABB3] leading-relaxed">
                Protecting the Mesoamerican Reef through real-time monitoring and AI-powered alerts.
              </p>
              <div className="flex items-center gap-4 mt-2">
                <a href="#" className="text-[#A7ABB3] hover:text-[#F2F3F5] transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="#" className="text-[#A7ABB3] hover:text-[#F2F3F5] transition-colors"><Youtube className="w-4 h-4" /></a>
                <a href="#" className="text-[#A7ABB3] hover:text-[#F2F3F5] transition-colors"><Instagram className="w-4 h-4" /></a>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="text-xs uppercase tracking-[0.15em] font-semibold mb-2">Platform</div>
              <div className="flex flex-col gap-3">
                {["Dashboard","API Docs","Live Data","Alerts"].map(l => (
                  <a key={l} href={l === "API Docs" ? "https://hackaton-ambiental-production.up.railway.app/docs" : "#"} target={l === "API Docs" ? "_blank" : undefined}
                    className="text-sm text-[#A7ABB3] hover:text-[#F2F3F5] transition-colors">{l}</a>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="text-xs uppercase tracking-[0.15em] font-semibold mb-2">Data Sources</div>
              <div className="flex flex-col gap-3">
                {["NOAA ERDDAP","Copernicus Marine","Open-Meteo","Claude AI"].map(l => (
                  <a key={l} href="#" className="text-sm text-[#A7ABB3] hover:text-[#F2F3F5] transition-colors">{l}</a>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="text-xs uppercase tracking-[0.15em] font-semibold mb-2">Newsletter</div>
              <p className="text-xs text-[#A7ABB3] mb-3">Get weekly reef health alerts.</p>
              <div className="flex flex-col gap-2">
                <input type="email" placeholder="Enter your email"
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-[#F2F3F5] placeholder-[#A7ABB3] focus:outline-none focus:border-cyan-400/50 transition-all" />
                <button className="px-4 py-2 border border-cyan-700 bg-cyan-900/40 rounded-lg text-xs font-medium hover:bg-cyan-800/50 transition-all text-cyan-300">
                  Subscribe
                </button>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#A7ABB3]">
            <div>© 2025 Coral Watch. All rights reserved.</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-[#F2F3F5] transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-[#F2F3F5] transition-colors">Terms of Service</a>
              <a href="https://hackaton-ambiental-production.up.railway.app/docs" target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition-colors">API Docs</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
