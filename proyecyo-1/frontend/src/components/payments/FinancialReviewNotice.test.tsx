import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { FinancialReviewNotice } from "./FinancialReviewNotice";
test("presenta un sobrepago para revision sin convertirlo en deuda negativa", () => {
  render(<FinancialReviewNotice sobrepago={5} requiere_revision />);
  expect(screen.getByRole("alert")).toHaveTextContent("sobrepago");
  expect(screen.getByRole("alert")).toHaveTextContent("5.00");
});
test("no presenta avisos para contratos historicos sin sobrepago", () => {
  render(<FinancialReviewNotice />);
  expect(screen.queryByRole("alert")).toBeNull();
});
