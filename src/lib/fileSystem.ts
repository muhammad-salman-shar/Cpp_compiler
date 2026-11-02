/**
 * File I/O helpers that work on web and inside the Capacitor Android WebView.
 *  - openFileFromDevice: hidden <input type="file">  (works everywhere)
 *  - saveFileToDevice:   web = Blob download;  native = Capacitor Filesystem (Documents)
 *  - shareFile:          web = Web Share API;  native = Capacitor Share
 */

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export interface FileHandle {
  name: string;
  contents: string;
}

export interface SaveResult {
  ok: boolean;
  message: string;
}

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** Legacy API — always "supported" now. */
export function isFileSystemAccessSupported(): boolean {
  return true;
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  return cleaned || "untitled.cpp";
}

export async function openFileFromDevice(): Promise<FileHandle | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".cpp,.c,.h,.hpp,.cc,.cxx,.txt,text/plain,text/x-c";
    input.style.position = "fixed";
    input.style.left = "-9999px";
    const cleanup = () => { try { input.remove(); } catch { /* ignore */ } };
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); cleanup(); return; }
      try {
        const contents = await file.text();
        resolve({ name: file.name, contents });
      } catch {
        resolve(null);
      } finally {
        cleanup();
      }
    };
    input.addEventListener("cancel", () => { resolve(null); cleanup(); });
    document.body.appendChild(input);
    input.click();
  });
}

export async function saveFileToDevice(content: string, filename: string): Promise<SaveResult> {
  const safe = sanitizeFilename(filename);

  if (isNativeApp()) {
    try {
      await Filesystem.writeFile({
        path: `CppCompiler/${safe}`,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      return { ok: true, message: `Saved to Documents/CppCompiler/${safe}` };
    } catch (e: any) {
      return { ok: false, message: e?.message || "Save failed" };
    }
  }

  try {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = safe;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { ok: true, message: `Downloading ${safe}` };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Download failed" };
  }
}

export async function shareFile(content: string, filename: string): Promise<SaveResult> {
  const safe = sanitizeFilename(filename);

  if (isNativeApp()) {
    try {
      const w = await Filesystem.writeFile({
        path: safe,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({ title: safe, url: w.uri, dialogTitle: "Share " + safe });
      return { ok: true, message: "Shared" };
    } catch (e: any) {
      return { ok: false, message: e?.message || "Share failed" };
    }
  }

  try {
    const nav: any = navigator;
    const file = new File([content], safe, { type: "text/plain;charset=utf-8" });
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title: safe });
      return { ok: true, message: "Shared" };
    }
  } catch { /* fall through to download */ }

  return saveFileToDevice(content, safe);
}

/* ---------------- legacy shims used by existing callers ---------------- */

export async function openFileWithPicker(): Promise<FileHandle | null> {
  return openFileFromDevice();
}

export async function saveFileWithPicker(content: string, suggestedName = "untitled.cpp"): Promise<boolean> {
  try {
    window.dispatchEvent(new CustomEvent("cclite:save-as", { detail: { content, suggestedName } }));
  } catch { /* ignore */ }
  return false;
}

export function setupFileHandler(onFileOpen: (name: string, contents: string) => void): void {
  const w: any = window;
  if ("launchQueue" in window && w.launchQueue?.setConsumer) {
    w.launchQueue.setConsumer((launchParams: any) => {
      if (launchParams.files && launchParams.files.length > 0) {
        launchParams.files.forEach(async (file: any) => {
          try {
            const contents = await file.text();
            onFileOpen(file.name, contents);
          } catch (err) {
            console.error("Failed to read file:", err);
          }
        });
      }
    });
  }
}
