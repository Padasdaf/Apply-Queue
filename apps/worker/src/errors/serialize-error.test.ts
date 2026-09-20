import { describe, expect, it } from "vitest";
import {
  formatErrorMessage,
  isTransientBrowserReadError,
  PostNavigationStepError,
  serializeError,
} from "./serialize-error.js";

describe("worker error diagnostics", () => {
  it("preserves a Stagehand RPC cause and its protocol details", () => {
    const rpcError = new Error("Uncaught", {
      cause: {
        code: -32603,
        message: "Uncaught",
        data: { name: "Error", authorization: "must-not-be-logged" },
      },
    });
    const wrapped = new PostNavigationStepError("FORM_INSPECTION", rpcError);

    expect(serializeError(wrapped)).toMatchObject({
      name: "PostNavigationStepError",
      category: "RPC",
      step: "FORM_INSPECTION",
      cause: {
        name: "Error",
        message: "Uncaught",
        cause: {
          code: -32603,
          message: "Uncaught",
          data: { name: "Error", authorization: "[redacted]" },
        },
      },
    });
    expect(isTransientBrowserReadError(wrapped)).toBe(true);
    expect(formatErrorMessage(wrapped)).toContain("FORM_INSPECTION");
    expect(formatErrorMessage(wrapped)).toContain("-32603");
  });

  it("classifies an execution-context failure as a transient read error", () => {
    expect(isTransientBrowserReadError(new Error("Execution context was destroyed during navigation"))).toBe(true);
  });

  it("does not classify stack-frame names as the error category", () => {
    const error = new Error("Uncaught");
    error.stack = "Error: Uncaught\n    at runWithTimeout (/test/runner.js:1:1)";
    expect(serializeError(error).category).toBe("UNKNOWN");
  });
});
