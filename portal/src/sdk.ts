export type PortalTarget = "generic" | "crazygames" | "poki" | "gamedistribution";

export type PortalSdkEvent =
  | "loading-progress"
  | "loading-finished"
  | "gameplay-start"
  | "gameplay-stop"
  | "commercial-break"
  | "rewarded-break"
  | "mute"
  | "resume";

type BrowserLike = Window & {
  CrazyGames?: {
    SDK?: {
      init?: () => Promise<void> | void;
      game?: { gameplayStart?: () => void; gameplayStop?: () => void };
      ad?: { requestAd?: (kind: string) => Promise<void> | void };
    };
  };
  PokiSDK?: {
    init?: () => Promise<void> | void;
    gameLoadingProgress?: (payload: { percentageDone: number }) => void;
    gameLoadingFinished?: () => void;
    gameplayStart?: () => void;
    gameplayStop?: () => void;
    commercialBreak?: () => Promise<void> | void;
    rewardedBreak?: () => Promise<boolean> | boolean;
  };
  gdsdk?: { showAd?: () => Promise<void> | void };
};

export function createDuplicateEventGuard<T extends { id: string }>(onEventOrOptions: ((event: T) => void) | { onEvent: (event: T) => void }) {
  const onEvent = typeof onEventOrOptions === "function" ? onEventOrOptions : onEventOrOptions.onEvent;
  const seen = new Set<string>();

  return (event: T) => {
    if (seen.has(event.id)) {
      return false;
    }

    seen.add(event.id);
    onEvent(event);
    return true;
  };
}

function scriptForTarget(target: PortalTarget): string | null {
  if (target === "crazygames") {
    return "https://sdk.crazygames.com/crazygames-sdk-v3.js";
  }

  if (target === "poki") {
    return "https://game-cdn.poki.com/scripts/v2/poki-sdk.js";
  }

  return null;
}

function loadScript(doc: Document, src: string): Promise<void> {
  const existing = doc.querySelector(`script[src="${src}"]`);
  if (existing) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load portal SDK: ${src}`));
    doc.head.append(script);
  });
}

export function createPortalSdkAdapter(options: {
  target: PortalTarget;
  win?: BrowserLike;
  doc?: Document;
}) {
  const eventLog: PortalSdkEvent[] = [];
  let lastEvent: PortalSdkEvent | null = null;
  const win = options.win;

  const emit = (event: PortalSdkEvent, action?: () => void) => {
    if (lastEvent === event) {
      return false;
    }

    lastEvent = event;
    eventLog.push(event);
    action?.();
    return true;
  };

  return {
    target: options.target,
    eventLog,
    async load() {
      const src = scriptForTarget(options.target);
      if (src && options.doc) {
        await loadScript(options.doc, src).catch(() => undefined);
      }

      if (options.target === "crazygames") {
        await win?.CrazyGames?.SDK?.init?.();
      }

      if (options.target === "poki") {
        await win?.PokiSDK?.init?.();
      }
    },
    loadingProgress(percentageDone: number) {
      const safePercentage = Math.max(0, Math.min(1, percentageDone));
      emit("loading-progress", () => {
        win?.PokiSDK?.gameLoadingProgress?.({ percentageDone: safePercentage });
      });
    },
    loadingFinished() {
      emit("loading-finished", () => {
        win?.PokiSDK?.gameLoadingFinished?.();
      });
    },
    gameplayStart() {
      emit("gameplay-start", () => {
        win?.CrazyGames?.SDK?.game?.gameplayStart?.();
        win?.PokiSDK?.gameplayStart?.();
      });
    },
    gameplayStop() {
      emit("gameplay-stop", () => {
        win?.CrazyGames?.SDK?.game?.gameplayStop?.();
        win?.PokiSDK?.gameplayStop?.();
      });
    },
    async commercialBreak() {
      if (!emit("commercial-break")) {
        return;
      }

      if (options.target === "crazygames") {
        await win?.CrazyGames?.SDK?.ad?.requestAd?.("midgame");
      } else if (options.target === "poki") {
        await win?.PokiSDK?.commercialBreak?.();
      } else if (options.target === "gamedistribution") {
        await win?.gdsdk?.showAd?.();
      }
    },
    async rewardedBreak() {
      if (!emit("rewarded-break")) {
        return false;
      }

      if (options.target === "crazygames") {
        await win?.CrazyGames?.SDK?.ad?.requestAd?.("rewarded");
        return true;
      }

      if (options.target === "poki") {
        return Boolean(await win?.PokiSDK?.rewardedBreak?.());
      }

      if (options.target === "gamedistribution") {
        await win?.gdsdk?.showAd?.();
        return true;
      }

      return false;
    },
    mute() {
      emit("mute");
    },
    resume() {
      emit("resume");
    },
  };
}
