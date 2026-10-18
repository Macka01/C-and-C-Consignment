import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { locationNameFromOrder, movementsFromTransfers, salesFromOrders } from "./shopify-match.ts";

describe("shopify feed mapping", () => {
  it("turns located orders into sales and skips cancelled lines", () => {
    const sales = salesFromOrders([
      {
        id: "line-1",
        orderName: "#100",
        createdAt: "2026-10-12T04:00:00Z",
        cancelled: false,
        locationName: "Love Local",
        quantity: 2,
        unitPrice: 12,
        product: {
          variantId: "gid://shopify/ProductVariant/1",
          sku: "STICKS",
          name: "Herb Sticks",
          productGroup: "Herb",
          description: "",
          retailPrice: 12,
        },
      },
      {
        id: "line-2",
        orderName: "#101",
        createdAt: "2026-10-12T04:00:00Z",
        cancelled: true,
        locationName: "Love Local",
        quantity: 1,
        unitPrice: 12,
        product: {
          variantId: "gid://shopify/ProductVariant/1",
          sku: "STICKS",
          name: "Herb Sticks",
          productGroup: "Herb",
          description: "",
          retailPrice: 12,
        },
      },
    ]);
    assert.equal(sales.length, 1);
    assert.equal(sales[0].occurredOn, "2026-10-12");
    assert.equal(sales[0].quantity, 2);
    assert.equal(sales[0].notes, "Shopify #100");
  });

  it("uses the retail location on an order, then the fulfillment location", () => {
    assert.equal(
      locationNameFromOrder({
        retailLocation: { name: "Harbour Linen" },
        fulfillmentOrders: { nodes: [{ assignedLocation: { name: "Studio", location: { name: "Studio" } } }] },
      }),
      "Harbour Linen",
    );
    assert.equal(
      locationNameFromOrder({
        retailLocation: null,
        fulfillments: { nodes: [{ location: { name: "Terrigal Home Room" } }] },
      }),
      "Terrigal Home Room",
    );
    assert.equal(locationNameFromOrder({ retailLocation: null, fulfillments: { nodes: [] } }), null);
  });

  it("splits a completed transfer into out at origin and in at destination", () => {
    const events = movementsFromTransfers([
      {
        id: "xfer-1",
        status: "TRANSFERRED",
        occurredOn: "2026-10-08T00:00:00Z",
        originName: "Studio",
        destinationName: "Love Local",
        quantity: 4,
        product: {
          variantId: "gid://shopify/ProductVariant/2",
          sku: "BOWL",
          name: "Bowl",
          productGroup: "Clay",
          description: "",
          retailPrice: 20,
        },
      },
    ]);
    assert.deepEqual(
      events.map((event) => [event.type, event.locationName, event.gid]),
      [
        ["transfer_out", "Studio", "xfer-1:out"],
        ["transfer_in", "Love Local", "xfer-1:in"],
      ],
    );
  });
});
