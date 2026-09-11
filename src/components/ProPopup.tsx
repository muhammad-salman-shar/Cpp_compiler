import { IconClose, IconCheck } from "./icons";

interface ProPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProPopup({ isOpen, onClose }: ProPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-sm">
      <div className="pop-in mx-4 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-ember-500/30 bg-gradient-to-br from-ink-850 via-ink-900 to-ink-950 shadow-2xl">
        {/* Header */}
        <div className="relative border-b border-ink-700/60 px-6 py-5">
          <div className="absolute inset-0 bg-gradient-to-r from-ember-500/10 via-transparent to-pulse-500/10" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-ember-500/20 px-2 py-0.5 font-display text-xs font-bold tracking-wider text-ember-400">
                  PRO
                </span>
                <h2 className="font-display text-xl font-bold tracking-wide text-mist-100">
                  Compiler Pro
                </h2>
              </div>
              <p className="mt-1 text-sm text-mist-500">Premium features for serious developers</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700/60 hover:text-mist-200"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {/* AI Section */}
            <FeatureSection
              icon="🤖"
              title="AI Coding Assistant"
              color="pulse"
              features={[
                "AI Code Writer — convert ideas to complete C++ code",
                "AI Error Detection — understand compiler errors",
                "AI Auto Fix — identify bugs and suggest corrections",
                "Code Explainer — simplify difficult C++ code",
                "Code Optimization — improve performance and quality",
                "AI Code Review — find potential problems",
                "Test Case Generator — auto-generate test cases",
                "Complexity Analysis — understand time & space complexity",
                "Documentation Generator — create comments and docs",
              ]}
            />

            {/* Advanced Section */}
            <FeatureSection
              icon="⚡"
              title="Advanced C++ Development"
              color="ember"
              features={[
                "Multiple-file project support",
                "C++11 / C++14 / C++17 / C++20 / C++23",
                "Advanced compiler configuration",
                "Custom compiler flags",
                "Integrated terminal",
                "Fast offline compilation",
                "Project management",
                "Import/export projects",
              ]}
            />

            {/* Experience Section */}
            <FeatureSection
              icon="🎨"
              title="Pro Experience"
              color="sky"
              features={[
                "Premium Themes",
                "Premium Animations",
                "Advanced editor customization",
                "Cleaner distraction-free coding",
                "Pro icons & UI effects",
                "No advertisements",
              ]}
            />

            {/* Learn Section */}
            <FeatureSection
              icon="🧠"
              title="Learn C++ Smarter"
              color="coral"
              features={[
                "Select any code → Explain with AI",
                "Error → Why did this happen?",
                "Error → Fix it",
                "Code → Improve it",
                "Problem → Generate solution",
                "Solution → Explain the logic",
              ]}
            />

            {/* BYO AI Section */}
            <FeatureSection
              icon="🔑"
              title="Bring Your Own AI"
              color="mint"
              features={[
                "Use your own API provider",
                "Enter: API URL, Model Name, API Key",
                "Save → connect → AI ready",
                "Your API, your model, your control",
              ]}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-ink-700/60 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-pulse-400" />
              <span className="text-sm font-medium text-mist-300">
                Compiler Pro — <span className="text-ember-400">Coming Soon</span>
              </span>
            </div>
            <button
              onClick={onClose}
              className="rounded-md bg-ink-700/60 px-4 py-2 font-display text-sm font-semibold text-mist-300 transition-all hover:bg-ink-700 active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureSection({ icon, title, color, features }: {
  icon: string;
  title: string;
  color: "pulse" | "ember" | "sky" | "coral" | "mint";
  features: string[];
}) {
  const colorClasses = {
    pulse: "border-pulse-500/30 bg-pulse-500/5",
    ember: "border-ember-500/30 bg-ember-500/5",
    sky: "border-sky-lt/30 bg-sky-lt/5",
    coral: "border-coral-500/30 bg-coral-500/5",
    mint: "border-pulse-400/30 bg-pulse-400/5",
  };

  const iconBgClasses = {
    pulse: "bg-pulse-500/20",
    ember: "bg-ember-500/20",
    sky: "bg-sky-lt/20",
    coral: "bg-coral-500/20",
    mint: "bg-pulse-400/20",
  };

  return (
    <div className={`rounded-lg border ${colorClasses[color]} p-4`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${iconBgClasses[color]} text-lg`}>
          {icon}
        </span>
        <h3 className="font-display text-base font-bold text-mist-100">{title}</h3>
      </div>
      <ul className="space-y-1.5">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-mist-400">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-mist-600" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
