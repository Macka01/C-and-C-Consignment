import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOpenPath } from "./access.ts";

describe("access paths", () => {
  it("lets a shop owner open a showcase without the tracker code", () => {
    assert.equal(isOpenPath("/showcase/4"), true);
    assert.equal(isOpenPath("/api/showcase/4"), true);
    assert.equal(isOpenPath("/api/products/4/image"), true);
    assert.equal(isOpenPath("/products/4"), false);
    assert.equal(isOpenPath("/api/products/4"), false);
  });
});
