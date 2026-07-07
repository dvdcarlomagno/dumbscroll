const test = require("node:test");
const assert = require("node:assert/strict");

const { canChangeDailyLimit, lockReason } = require("../content/shared/limit-lock.js");

test("allows changes below 50% usage", () => {
  assert.equal(canChangeDailyLimit(0, 100), true);
  assert.equal(canChangeDailyLimit(49, 100), true);
  assert.equal(canChangeDailyLimit(24, 50), true);
});

test("blocks changes at or above 50% usage", () => {
  assert.equal(canChangeDailyLimit(50, 100), false);
  assert.equal(canChangeDailyLimit(75, 100), false);
  assert.equal(canChangeDailyLimit(25, 50), false);
});

test("blocks changes when daily limit is reached", () => {
  assert.equal(canChangeDailyLimit(100, 100), false);
  assert.equal(canChangeDailyLimit(150, 100), false);
});

test("returns null reason when changes are allowed", () => {
  assert.equal(lockReason(10, 100), null);
});

test("returns limit-reached reason at 100% usage", () => {
  assert.match(lockReason(100, 100), /Daily limit reached/i);
});

test("returns halfway reason between 50% and 100% usage", () => {
  assert.match(lockReason(60, 100), /50%/i);
});

test("handles small daily limits", () => {
  assert.equal(canChangeDailyLimit(0, 1), true);
  assert.equal(canChangeDailyLimit(1, 1), false);
});
