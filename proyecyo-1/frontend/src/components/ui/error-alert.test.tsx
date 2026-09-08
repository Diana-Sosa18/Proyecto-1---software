import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorAlert } from "./error-alert";

describe("ErrorAlert", () => {
  it("muestra un error visible, permite cerrarlo y reintentar", () => {
    const dismiss = vi.fn();
    const retry = vi.fn();
    render(<ErrorAlert title="Error de carga" message="No se pudo cargar." onDismiss={dismiss} onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar.");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar mensaje de error" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("deshabilita realmente la acción mientras reintenta", () => {
    const retry = vi.fn();
    render(<ErrorAlert message="Error" onRetry={retry} retrying />);
    const button = screen.getByRole("button", { name: "Reintentando..." });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(retry).not.toHaveBeenCalled();
  });
});
