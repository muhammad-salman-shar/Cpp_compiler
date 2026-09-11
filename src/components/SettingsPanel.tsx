import { useState, useEffect } from "react";
import { IconClose } from "./icons";

export interface Settings {
  // Editor
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  autoCloseBrackets: boolean;
  highlightActiveLine: boolean;
  
  // Panel
  outputPanelSize: number; // percentage
  
  // Theme
  theme: "dark" | "light" | "system";
  
  // Compiler
  cppStandard: string;
  
  // Other
  autoSave: boolean;
  confirmBeforeClear: boolean;
  smoothScrolling: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  fontSize: 14,
  tabSize: 4,
  wordWrap: false,
  lineNumbers: true,
  autoCloseBrackets: true,
  highlightActiveLine: true,
  outputPanelSize: 38,
  theme: "dark",
  cppStandard: "C++17",
  autoSave: true,
  confirmBeforeClear: false,
  smoothScrolling: true,
};

const LS_SETTINGS = "cclite.settings.v1";

export function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem(LS_SETTINGS);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
  } catch { /* ignore */ }
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export function SettingsPanel({ isOpen, onClose, settings, onSave }: SettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (!isOpen) return null;

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-sm">
      <div className="pop-in mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-ink-700/60 bg-ink-850 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-700/60 px-5 py-4">
          <h2 className="font-display text-lg font-bold tracking-wide text-mist-100">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-mist-500 transition-colors hover:bg-ink-700/60 hover:text-mist-200"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            {/* Editor Section */}
            <section>
              <h3 className="mb-3 font-display text-sm font-semibold tracking-wide text-ember-400">EDITOR</h3>
              <div className="space-y-3">
                <SettingRow label="Font size" description="Editor text size in pixels">
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={localSettings.fontSize}
                    onChange={(e) => updateSetting("fontSize", Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="w-12 text-right font-mono text-sm text-mist-300">{localSettings.fontSize}px</span>
                </SettingRow>
                
                <SettingRow label="Tab size" description="Number of spaces per tab">
                  <select
                    value={localSettings.tabSize}
                    onChange={(e) => updateSetting("tabSize", Number(e.target.value))}
                    className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 font-mono text-sm text-mist-300"
                  >
                    <option value={2}>2 spaces</option>
                    <option value={4}>4 spaces</option>
                    <option value={8}>8 spaces</option>
                  </select>
                </SettingRow>

                <ToggleSetting
                  label="Word wrap"
                  description="Wrap long lines in the editor"
                  checked={localSettings.wordWrap}
                  onChange={(v) => updateSetting("wordWrap", v)}
                />

                <ToggleSetting
                  label="Line numbers"
                  description="Show line numbers in the gutter"
                  checked={localSettings.lineNumbers}
                  onChange={(v) => updateSetting("lineNumbers", v)}
                />

                <ToggleSetting
                  label="Auto-close brackets"
                  description="Automatically insert closing brackets"
                  checked={localSettings.autoCloseBrackets}
                  onChange={(v) => updateSetting("autoCloseBrackets", v)}
                />

                <ToggleSetting
                  label="Highlight active line"
                  description="Highlight the current line"
                  checked={localSettings.highlightActiveLine}
                  onChange={(v) => updateSetting("highlightActiveLine", v)}
                />
              </div>
            </section>

            {/* Panel Section */}
            <section>
              <h3 className="mb-3 font-display text-sm font-semibold tracking-wide text-ember-400">PANEL</h3>
              <div className="space-y-3">
                <SettingRow label="Output panel size" description="Height of the bottom panel">
                  <input
                    type="range"
                    min="20"
                    max="60"
                    value={localSettings.outputPanelSize}
                    onChange={(e) => updateSetting("outputPanelSize", Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="w-12 text-right font-mono text-sm text-mist-300">{localSettings.outputPanelSize}%</span>
                </SettingRow>
              </div>
            </section>

            {/* Theme Section */}
            <section>
              <h3 className="mb-3 font-display text-sm font-semibold tracking-wide text-ember-400">THEME</h3>
              <div className="space-y-3">
                <SettingRow label="Theme" description="Application color scheme">
                  <select
                    value={localSettings.theme}
                    onChange={(e) => updateSetting("theme", e.target.value as Settings["theme"])}
                    className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 font-mono text-sm text-mist-300"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </SettingRow>
              </div>
            </section>

            {/* Compiler Section */}
            <section>
              <h3 className="mb-3 font-display text-sm font-semibold tracking-wide text-ember-400">COMPILER</h3>
              <div className="space-y-3">
                <SettingRow label="C++ standard" description="Language standard (subset only)">
                  <select
                    value={localSettings.cppStandard}
                    onChange={(e) => updateSetting("cppStandard", e.target.value)}
                    className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 font-mono text-sm text-mist-300"
                  >
                    <option value="C++11">C++11</option>
                    <option value="C++14">C++14</option>
                    <option value="C++17">C++17</option>
                    <option value="C++20">C++20</option>
                    <option value="C++23">C++23</option>
                  </select>
                </SettingRow>
                <p className="text-xs text-mist-600">
                  Note: This is a subset compiler. Not all C++ features are supported.
                </p>
              </div>
            </section>

            {/* Other Section */}
            <section>
              <h3 className="mb-3 font-display text-sm font-semibold tracking-wide text-ember-400">OTHER</h3>
              <div className="space-y-3">
                <ToggleSetting
                  label="Auto-save"
                  description="Automatically save code to browser storage"
                  checked={localSettings.autoSave}
                  onChange={(v) => updateSetting("autoSave", v)}
                />

                <ToggleSetting
                  label="Confirm before clearing"
                  description="Ask before clearing the editor"
                  checked={localSettings.confirmBeforeClear}
                  onChange={(v) => updateSetting("confirmBeforeClear", v)}
                />

                <ToggleSetting
                  label="Smooth scrolling"
                  description="Use smooth scrolling in panels"
                  checked={localSettings.smoothScrolling}
                  onChange={(v) => updateSetting("smoothScrolling", v)}
                />
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-ink-700/60 px-5 py-4">
          <button
            onClick={handleReset}
            className="rounded-md px-4 py-2 font-display text-sm font-semibold text-mist-400 transition-colors hover:bg-ink-700/60 hover:text-mist-200"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 font-display text-sm font-semibold text-mist-400 transition-colors hover:bg-ink-700/60 hover:text-mist-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-md bg-ember-500 px-4 py-2 font-display text-sm font-bold text-ink-950 transition-all hover:bg-ember-400 active:scale-95"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <div className="text-sm font-medium text-mist-200">{label}</div>
        <div className="text-xs text-mist-600">{description}</div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function ToggleSetting({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <div className="text-sm font-medium text-mist-200">{label}</div>
        <div className="text-xs text-mist-600">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-ember-500" : "bg-ink-700"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
