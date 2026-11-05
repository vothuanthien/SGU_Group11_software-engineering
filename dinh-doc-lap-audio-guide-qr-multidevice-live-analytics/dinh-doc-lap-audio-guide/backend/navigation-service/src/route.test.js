import { describe, expect, it } from "vitest";
import {
  buildEstimatedRoute,
  compassDirection,
  haversineMeters,
  initialBearingDegrees,
  isValidCoordinate,
} from "./route.js";

const attractions = [
  { id: "start", name_vi: "Điểm xuất phát", latitude: 10.7769, longitude: 106.6953 },
  { id: "room", name_vi: "Phòng tham quan", latitude: 10.7768, longitude: 106.6954 },
];

describe("Navigation Service route calculations", () => {
  it("validates latitude and longitude ranges", () => {
    expect(isValidCoordinate({ lat: 10.7, lng: 106.6 })).toBe(true);
    expect(isValidCoordinate({ lat: 91, lng: 106.6 })).toBe(false);
    expect(isValidCoordinate({ lat: 10.7, lng: "not-a-number" })).toBe(false);
    expect(isValidCoordinate({ lat: null, lng: null })).toBe(false);
    expect(isValidCoordinate({ lat: "", lng: "" })).toBe(false);
  });

  it("calculates zero distance for the same coordinate", () => {
    expect(haversineMeters({ lat: 10, lng: 106 }, { lat: 10, lng: 106 })).toBe(0);
  });

  it("calculates a compass bearing for a destination to the east", () => {
    const bearing = initialBearingDegrees({ lat: 10, lng: 106 }, { lat: 10, lng: 107 });
    expect(bearing).toBeGreaterThan(80);
    expect(bearing).toBeLessThan(100);
    expect(compassDirection(bearing)).toBe("Đông");
  });

  it("builds an estimated route from the configured start point", () => {
    const result = buildEstimatedRoute({ attractions, destinationId: "room" });
    expect(result.data.routeType).toBe("coordinate-estimate");
    expect(result.data.coordinates).toHaveLength(2);
    expect(result.data.distanceMeters).toBeGreaterThan(0);
    expect(result.data.instructionVi).toContain("Phòng");
    expect(result.data.isIndoorRoute).toBe(false);
  });

  it("uses GPS as the route origin when supplied", () => {
    const result = buildEstimatedRoute({
      attractions,
      destinationId: "room",
      origin: { lat: 10.777, lng: 106.695 },
    });
    expect(result.data.origin.type).toBe("gps");
    expect(result.data.coordinates[0]).toEqual([10.777, 106.695]);
  });

  it("returns a clear error when destination has no coordinates", () => {
    const result = buildEstimatedRoute({
      attractions: [{ id: "empty", latitude: null, longitude: null }],
      destinationId: "empty",
    });
    expect(result.error).toBe("DESTINATION_COORDINATE_MISSING");
  });
});
