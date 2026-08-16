import {
  evaluateWorkingRoute,
  sampleRouteQuery,
  sampleRouteRecords,
} from "./working-route.mjs";

const assessment = evaluateWorkingRoute(
  sampleRouteRecords,
  sampleRouteQuery,
  "2026-08-15T19:00:00.000Z",
);

const route = assessment.workingRoute;

console.log("Agent WEX local developer preview");
console.log("capture  3 minimized route outcomes");
console.log(`verify   ${assessment.evidence.successfulIndependentRoots} independent success roots; ${assessment.evidence.copiesCollapsed} dependent root collapsed`);
console.log(`return   ${route ? `tool ${route.toolVersion} + client ${route.clientVersion}` : "no supported route"}`);
console.log(`runtime  ${assessment.nextAction}`);
console.log(`authority granted by Agent WEX: ${assessment.authorityGranted}`);
