import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "../../src/domain/workflow/transitions.js";
import { InvalidStateTransitionError } from "../../src/domain/errors.js";

describe("workflow state machine", () => {
  it("allows the happy path through counsel outcomes", () => {
    const path = [
      ["INIT", "EXTRACTING"],
      ["EXTRACTING", "ASSESSING"],
      ["ASSESSING", "DRAFTING"],
      ["DRAFTING", "AWAITING_APPROVAL"],
      ["AWAITING_APPROVAL", "APPROVED"],
      ["APPROVED", "COMPLETED"],
    ] as const;

    for (const [from, to] of path) {
      expect(canTransition(from, to)).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
    }

    expect(canTransition("AWAITING_APPROVAL", "REJECTED")).toBe(true);
    expect(canTransition("AWAITING_APPROVAL", "EDITED")).toBe(true);
    expect(canTransition("REJECTED", "COMPLETED")).toBe(true);
    expect(canTransition("EDITED", "COMPLETED")).toBe(true);
  });

  it("refuses skipping the counsel gate", () => {
    expect(canTransition("DRAFTING", "APPROVED")).toBe(false);
    expect(canTransition("INIT", "COMPLETED")).toBe(false);
    expect(() => assertTransition("AWAITING_APPROVAL", "EXTRACTING")).toThrow(
      InvalidStateTransitionError,
    );
  });
});
