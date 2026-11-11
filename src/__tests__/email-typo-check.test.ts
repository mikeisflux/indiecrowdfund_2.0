import { describe, it, expect } from "vitest";
import { suggestEmailCorrection } from "@/lib/email/typo-check";
describe("suggestEmailCorrection", () => {
  it("cases", () => {
    expect(suggestEmailCorrection("roger@ramwebsolutions.comm")).toMatchObject({ suggestion: "roger@ramwebsolutions.com", hard: true });
    expect(suggestEmailCorrection("a@gmial.com")).toMatchObject({ suggestion: "a@gmail.com", hard: true });
    expect(suggestEmailCorrection("a@bbc.co.ku")).toMatchObject({ suggestion: "a@bbc.co.uk", hard: true });
    expect(suggestEmailCorrection("a@example.com.")).toMatchObject({ hard: false });
    expect(suggestEmailCorrection("someone@outlook.com")).toBeNull();
    expect(suggestEmailCorrection("a@example.co")).toBeNull();
    expect(suggestEmailCorrection("a@mail.example.net")).toBeNull();
    expect(suggestEmailCorrection("a@foo.cm")).toMatchObject({ suggestion: "a@foo.com", hard: false });
  });
});
