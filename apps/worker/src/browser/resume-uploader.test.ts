import { describe, expect, it, vi } from "vitest";
import type { Page } from "@browserbasehq/stagehand";
import { makeProfileBundle } from "../test/profile-fixture.js";
import { uploadResumeToField } from "./resume-uploader.js";

describe("native resume upload", () => {
  it("passes the private PDF bytes to Stagehand setInputFiles", async () => {
    const setInputFiles = vi.fn().mockResolvedValue(undefined);
    const inputValue = vi.fn().mockResolvedValue("C:\\fakepath\\ada-resume.pdf");
    const locator = vi.fn(() => ({ setInputFiles, inputValue }));
    const page = { locator } as unknown as Page;
    const document = makeProfileBundle().documents[0]!;
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

    await uploadResumeToField(page, {
      identifier: "resume",
      label: "Resume / CV",
      selector: "xpath=/html/body/iframe/html/body/form/input[2]",
      type: "file",
      required: true,
    }, { document, bytes }, {
      kind: "FRAME",
      url: "https://embedded.example/application",
      name: "Application",
      xpathPrefix: "/html/body/iframe",
      index: 0,
    });

    expect(setInputFiles).toHaveBeenCalledWith(expect.objectContaining({
      name: "ada-resume.pdf",
      mimeType: "application/pdf",
      buffer: bytes,
    }));
    expect(locator).toHaveBeenCalledWith("xpath=/html/body/iframe/html/body/form/input[2]");
  });
});
