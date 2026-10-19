import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeServerAddress, serverAddressSections } from "./server-addresses.ts";

describe("server address groups", () => {
  it("keeps this Mac, the home Wi-Fi, and Tailscale apart", () => {
    const sections = serverAddressSections(
      [
        "http://100.73.158.74:43123",
        "http://192.168.1.20:43123",
        "http://homeserver:43123",
        "http://wendys-mbp.local:43123",
        "https://homeserver.tailnet.ts.net",
        "http://172.17.0.1:43123",
        "http://192.168.65.1:43123",
      ],
      43123,
    );
    const byId = Object.fromEntries(sections.map((section) => [section.id, section.addresses.map((address) => address.label)]));
    assert.deepEqual(byId.mac, ["This Mac", "Docker on this Mac", "Docker on this Mac"]);
    assert.deepEqual(byId.wifi, ["Bonjour name", "Wi-Fi address"]);
    assert.deepEqual(byId.remote, ["Tailscale name", "Tailscale address", "Tailscale web address"]);
    assert.equal(sections[0].addresses[0].href, "http://127.0.0.1:43123");
    assert.match(sections.find((section) => section.id === "wifi")?.explanation ?? "", /same Wi-Fi/);
    assert.match(sections.find((section) => section.id === "remote")?.explanation ?? "", /100\.64/);
  });

  it("treats private ranges as local and the Tailscale range as non-local", () => {
    assert.equal(describeServerAddress("http://10.0.0.8:43123").group, "wifi");
    assert.equal(describeServerAddress("http://172.16.4.4:43123").group, "wifi");
    assert.equal(describeServerAddress("http://100.64.0.1:43123").group, "remote");
    assert.equal(describeServerAddress("http://100.127.255.255:43123").group, "remote");
    assert.equal(describeServerAddress("http://100.63.1.1:43123").group, "remote");
    assert.equal(describeServerAddress("http://100.128.0.1:43123").group, "remote");
    assert.equal(describeServerAddress("http://100.63.1.1:43123").label, "Public address");
    assert.equal(describeServerAddress("https://tracker.example.com").label, "Other address");
  });

  it("still shows this Mac when no other address was found", () => {
    const sections = serverAddressSections([], 43123);
    assert.equal(sections[0].addresses.length, 1);
    assert.equal(sections[1].addresses.length, 0);
    assert.equal(sections[2].addresses.length, 0);
  });
});
