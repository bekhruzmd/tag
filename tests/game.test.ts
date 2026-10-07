import { test } from "node:test";
import assert from "node:assert/strict";
import { distance, circle, countdown, clock } from "../src/lib/types";
import { demoGame, demoAction, advanceDemo } from "../src/lib/demo";
test("geographic distance uses meters across the date line", () => {
  assert.equal(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  assert.ok(
    Math.abs(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111195) < 2,
  );
  assert.ok(
    distance({ lat: 0, lng: 179.999 }, { lat: 0, lng: -179.999 }) < 223,
  );
});
test("circle is closed and its north point is approximately the radius away", () => {
  const points = circle(-73.9965, 40.7295, 400);
  assert.ok(
    distance(
      { lat: points[0][1], lng: points[0][0] },
      { lat: points[96][1], lng: points[96][0] },
    ) < 0.001,
  );
  assert.ok(
    Math.abs(
      distance(
        { lat: 40.7295, lng: -73.9965 },
        { lat: points[24][1], lng: points[24][0] },
      ) - 400,
    ) < 2,
  );
});
test("countdown never renders negative time", () => {
  assert.equal(countdown(new Date(1000).toISOString(), 2000), 0);
  assert.equal(clock(65), "01:05");
});
test("practice loop covers hiding, snapshot expiry, shrink, confirmed tags and seekers winning", () => {
  let g = demoAction(demoGame(), "start", {});
  assert.equal(g.phase, "hiding");
  g = advanceDemo(g, Date.parse(g.phase_ends!));
  assert.equal(g.phase, "hunting");
  g = advanceDemo(g, Date.parse(g.next_reveal!));
  assert.equal(g.reveals.length, 4);
  const points = structuredClone(g.reveals);
  g = advanceDemo(g, Date.parse(g.reveal_expires!) - 1);
  assert.deepEqual(g.reveals, points);
  g = advanceDemo(g, Date.parse(g.reveal_expires!));
  assert.equal(g.reveals.length, 0);
  g = advanceDemo(g, Date.parse(g.next_shrink!));
  assert.equal(g.radius, 280);
  for (let i = 0; i < 4; i++) g = demoAction(g, "tag", {});
  assert.equal(g.winner, "seekers");
  assert.equal(g.phase, "finished");
});
test("practice timer awards a surviving hider the win", () => {
  const g = demoAction(demoGame(), "start", {});
  const ended = advanceDemo(g, Date.parse(g.ends_at!));
  assert.equal(ended.winner, "hiders");
  assert.equal(ended.reveals.length, 0);
});
