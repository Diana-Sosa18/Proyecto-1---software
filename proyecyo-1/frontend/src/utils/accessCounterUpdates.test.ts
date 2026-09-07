import { afterEach, describe, expect, it, vi } from "vitest";

import {
  notifyAccessCountersChanged,
  subscribeToAccessCounterUpdates,
} from "@/utils/accessCounterUpdates";

class BroadcastChannelMock extends EventTarget {
  static instances: BroadcastChannelMock[] = [];
  readonly name: string;
  postMessage = vi.fn();
  close = vi.fn();

  constructor(name: string) {
    super();
    this.name = name;
    BroadcastChannelMock.instances.push(this);
  }
}

describe("actualizacion de contadores de accesos", () => {
  afterEach(() => {
    BroadcastChannelMock.instances = [];
    vi.unstubAllGlobals();
  });

  it("notifica a la pestaña actual y a las demás pestañas", () => {
    vi.stubGlobal("BroadcastChannel", BroadcastChannelMock);
    const localListener = vi.fn();
    window.addEventListener("nexus:access-counters-changed", localListener);

    notifyAccessCountersChanged();

    expect(localListener).toHaveBeenCalledOnce();
    expect(BroadcastChannelMock.instances[0]?.name).toBe("nexus-access-counters");
    expect(BroadcastChannelMock.instances[0]?.postMessage).toHaveBeenCalledWith({
      type: "access-counters-changed",
    });
    expect(BroadcastChannelMock.instances[0]?.close).toHaveBeenCalledOnce();

    window.removeEventListener("nexus:access-counters-changed", localListener);
  });

  it("suscribe, recibe eventos locales y libera todos los recursos", () => {
    vi.stubGlobal("BroadcastChannel", BroadcastChannelMock);
    const listener = vi.fn();
    const unsubscribe = subscribeToAccessCounterUpdates(listener);
    const channel = BroadcastChannelMock.instances[0];

    window.dispatchEvent(new Event("nexus:access-counters-changed"));
    channel.dispatchEvent(new MessageEvent("message"));
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    window.dispatchEvent(new Event("nexus:access-counters-changed"));
    channel.dispatchEvent(new MessageEvent("message"));

    expect(listener).toHaveBeenCalledTimes(2);
    expect(channel.close).toHaveBeenCalledOnce();
  });
});
