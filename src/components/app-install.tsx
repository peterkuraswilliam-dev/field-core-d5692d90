import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export function AppInstallButton({ compact = false }: { compact?: boolean }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setPrompt(null);
      return;
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast.info(
      ios
        ? "Tap Share, then Add to Home Screen."
        : "Open your browser menu and choose Install app or Add to Home screen.",
      { duration: 6000 },
    );
  };

  return (
    <button
      type="button"
      onClick={install}
      className={
        compact
          ? "inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 text-sm font-semibold text-gold transition hover:bg-gold/15"
          : "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-5 text-sm font-semibold text-gold transition hover:bg-gold/15 active:scale-[0.99]"
      }
    >
      {/iphone|ipad|ipod/i.test(typeof navigator === "undefined" ? "" : navigator.userAgent) ? (
        <Share2 size={18} />
      ) : (
        <Download size={18} />
      )}
      {compact ? "Get the app" : "Download the Android app"}
    </button>
  );
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
