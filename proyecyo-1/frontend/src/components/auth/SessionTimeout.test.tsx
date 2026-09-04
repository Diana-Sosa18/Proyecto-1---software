import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logout = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true, logout }),
}));

// Se usan tiempos cortos para poder simular la inactividad de forma determinista.
vi.mock("@/config/session", () => ({
  SESSION_TIMEOUT_MS: 3000,
  SESSION_WARNING_MS: 1000,
  ACTIVITY_THROTTLE_MS: 0,
  LOGOUT_EVENT_KEY: "nexus.logout",
}));

import { SessionTimeout } from "@/components/auth/SessionTimeout";

describe("SessionTimeout (cierre por inactividad)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    logout.mockClear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("muestra el aviso previo antes de cerrar la sesion", () => {
    render(<SessionTimeout />);
    expect(screen.queryByRole("dialog")).toBeNull();

    // Avanza hasta el momento del aviso (tiempo total menos ventana de aviso).
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it("cierra la sesion al cumplirse el tiempo de inactividad", () => {
    render(<SessionTimeout />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("reinicia el temporizador cuando hay actividad del usuario", () => {
    render(<SessionTimeout />);

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    // La actividad del usuario reinicia la cuenta regresiva.
    act(() => {
      window.dispatchEvent(new Event("click"));
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(logout).not.toHaveBeenCalled();
  });
});
