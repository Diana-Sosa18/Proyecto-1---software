const ACCESS_COUNTER_EVENT = "nexus:access-counters-changed";
const ACCESS_COUNTER_CHANNEL = "nexus-access-counters";

export function notifyAccessCountersChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ACCESS_COUNTER_EVENT));

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(ACCESS_COUNTER_CHANNEL);
    channel.postMessage({ type: "access-counters-changed" });
    channel.close();
  }
}

export function subscribeToAccessCounterUpdates(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(ACCESS_COUNTER_EVENT, listener);
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(ACCESS_COUNTER_CHANNEL)
      : null;

  channel?.addEventListener("message", listener);

  return () => {
    window.removeEventListener(ACCESS_COUNTER_EVENT, listener);
    channel?.removeEventListener("message", listener);
    channel?.close();
  };
}
