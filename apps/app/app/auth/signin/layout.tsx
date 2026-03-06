import type React from "react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#06060a] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 relative overflow-hidden border-r border-white/[0.05]">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[10%] left-[10%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[5%] w-[300px] h-[300px] rounded-full bg-purple-600/10 blur-[100px]" />
          <div className="absolute top-[50%] left-[40%] w-[250px] h-[250px] rounded-full bg-blue-500/8 blur-[90px]" />
          {/* dot grid */}
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-500/10 border border-cyan-500/30 p-2 rounded-lg">
              <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.357 2.059l.537.268a2.25 2.25 0 001.357 2.059" />
              </svg>
            </div>
            <div>
              <div className="text-[15px] font-black tracking-[0.1em] uppercase text-white font-mono">Entropy</div>
              <div className="text-[8px] text-white/30 tracking-[0.25em] uppercase font-mono">Cognitive OS · v2.0</div>
            </div>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 mb-3 font-mono">// PLATFORM</div>
            <h2 className="text-4xl font-black text-white leading-tight tracking-tight">
              Learn Deeper.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">Think Sharper.</span>
            </h2>
            <p className="text-white/40 text-sm mt-4 leading-relaxed font-mono max-w-sm">
              An AI-powered cognitive platform with a 7-layer reasoning engine, live knowledge graph, and adaptive mastery tracking.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { value: "7", label: "AI Layers" },
              { value: "3", label: "Databases" },
              { value: "2+", label: "AI Providers" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center font-mono">
                <div className="text-2xl font-black text-cyan-400">{s.value}</div>
                <div className="text-[9px] uppercase tracking-[0.15em] text-white/30 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2 font-mono">
            {[
              "7-Layer AI Reasoning Pipeline",
              "Neo4j Live Knowledge Graph",
              "Adaptive Mastery Tracking",
              "Community Q&A + Gamification",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3 text-[12px] text-white/50">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="text-[10px] font-mono text-white/20 uppercase tracking-widest">Built by Team Planet · March 2026</div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
