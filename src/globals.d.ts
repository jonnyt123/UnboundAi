interface Window {
  webkitAudioContext?: typeof AudioContext;
  __THREAD_NULL_READY__?: boolean;
  __THREAD_NULL_METRICS__?: { fps: number; frameP95Ms: number; renderP95Ms: number; particles: number; quality: string };
  __THREAD_NULL_TEST__?: {
    start: () => void;
    forceLoop: () => unknown;
    dense: () => void;
    victory: () => void;
    failure: () => void;
    pause: () => void;
    resume: () => void;
    state: () => unknown;
  };
}
