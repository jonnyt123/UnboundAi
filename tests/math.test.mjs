import test from 'node:test';
import assert from 'node:assert/strict';
import { pointInPolygon, polygonArea, polylineLength } from '../src/core/math.js';

test('pointInPolygon identifies inside and outside points', () => {
  const square = [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
  assert.equal(pointInPolygon({x:50,y:50}, square), true);
  assert.equal(pointInPolygon({x:120,y:50}, square), false);
});

test('polygonArea is orientation independent', () => {
  const a = [{x:0,y:0},{x:100,y:0},{x:100,y:50},{x:0,y:50}];
  assert.equal(polygonArea(a), 5000);
  assert.equal(polygonArea([...a].reverse()), 5000);
});

test('polylineLength sums deterministic segments', () => {
  assert.equal(polylineLength([{x:0,y:0},{x:3,y:4},{x:6,y:8}]), 10);
});
