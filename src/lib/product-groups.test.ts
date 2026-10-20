import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupByProductGroup } from "./product-groups.ts";

describe("product grouping", () => {
  it("groups by Shopify type and puts an empty type last", () => {
    const grouped = groupByProductGroup([
      { productGroup: "Handmade", name: "Everyday Bowl" },
      { productGroup: "Flax ceramics", name: "Flax Mug" },
      { productGroup: "", name: "Loose stem" },
      { productGroup: "Flax ceramics", name: "Flax Serve Bowl" },
    ]);
    assert.deepEqual(
      grouped.map((section) => [section.group, section.items.map((item) => item.name)]),
      [
        ["Flax ceramics", ["Flax Mug", "Flax Serve Bowl"]],
        ["Handmade", ["Everyday Bowl"]],
        ["", ["Loose stem"]],
      ],
    );
  });
});
