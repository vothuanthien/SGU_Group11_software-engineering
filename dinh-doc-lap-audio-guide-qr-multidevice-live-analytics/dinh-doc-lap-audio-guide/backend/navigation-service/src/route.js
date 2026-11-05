const EARTH_RADIUS_METERS = 6_371_000;
const WALKING_SPEED_METERS_PER_SECOND = 1.1;

export function isValidCoordinate(point) {
  if (!point || typeof point !== "object") return false;
  const rawLatitude = point.lat ?? point.latitude;
  const rawLongitude = point.lng ?? point.longitude;
  if (
    rawLatitude == null ||
    rawLongitude == null ||
    rawLatitude === "" ||
    rawLongitude === ""
  ) return false;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function toCoordinate(point) {
  if (!isValidCoordinate(point)) return null;
  return {
    lat: Number(point.lat ?? point.latitude),
    lng: Number(point.lng ?? point.longitude),
  };
}

export function initialBearingDegrees(from, to) {
  const radians = (value) => (value * Math.PI) / 180;
  const degrees = (value) => ((value * 180) / Math.PI + 360) % 360;
  const lat1 = radians(from.lat);
  const lat2 = radians(to.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const y = Math.sin(longitudeDelta) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(longitudeDelta);
  return degrees(Math.atan2(y, x));
}

export function compassDirection(bearing, language = "vi") {
  const directions =
    language === "en"
      ? ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]
      : ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"];
  return directions[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

export function haversineMeters(from, to) {
  const radians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = radians(to.lat - from.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function buildEstimatedRoute({
  attractions,
  destinationId,
  origin,
  originAttractionId,
}) {
  const destination = attractions.find((item) => item.id === destinationId);
  if (!destination) {
    return { error: "DESTINATION_NOT_FOUND", message: "Không tìm thấy điểm đến" };
  }

  const destinationCoordinate = toCoordinate(destination);
  if (!destinationCoordinate) {
    return {
      error: "DESTINATION_COORDINATE_MISSING",
      message: "Điểm đến chưa được cấu hình tọa độ hợp lệ",
    };
  }

  let start;
  let originDetails;
  if (origin !== undefined && origin !== null) {
    if (!isValidCoordinate(origin)) {
      return { error: "INVALID_ORIGIN", message: "Tọa độ vị trí hiện tại không hợp lệ" };
    }
    start = toCoordinate(origin);
    originDetails = {
      type: "gps",
      label: "Vị trí hiện tại",
      labelEn: "your current location",
    };
  } else {
    const originAttraction =
      attractions.find((item) => item.id === originAttractionId) ||
      attractions.find((item) => isValidCoordinate(item));
    if (!originAttraction) {
      return {
        error: "ORIGIN_NOT_CONFIGURED",
        message: "Chưa có tọa độ điểm xuất phát",
      };
    }
    start = toCoordinate(originAttraction);
    originDetails = {
      type: "attraction",
      id: originAttraction.id,
      label: originAttraction.name_vi || originAttraction.id,
      labelEn: originAttraction.name_en || originAttraction.id,
    };
  }

  const distanceMeters = Math.round(haversineMeters(start, destinationCoordinate));
  const coordinates =
    distanceMeters === 0
      ? [[start.lat, start.lng]]
      : [
          [start.lat, start.lng],
          [destinationCoordinate.lat, destinationCoordinate.lng],
        ];
  const durationMinutes = Math.max(
    distanceMeters === 0 ? 0 : 1,
    Math.ceil(distanceMeters / WALKING_SPEED_METERS_PER_SECOND / 60),
  );
  const bearingDegrees = initialBearingDegrees(start, destinationCoordinate);
  const direction = compassDirection(bearingDegrees, "vi");
  const directionEn = compassDirection(bearingDegrees, "en");
  const destinationNameVi = destination.name_vi || destination.id;
  const destinationNameEn = destination.name_en || destination.id;

  return {
    data: {
      origin: originDetails,
      destination: {
        id: destination.id,
        name_vi: destination.name_vi,
        name_en: destination.name_en,
        latitude: destinationCoordinate.lat,
        longitude: destinationCoordinate.lng,
      },
      distanceMeters,
      durationMinutes,
      bearingDegrees: Math.round(bearingDegrees),
      direction,
      instructionVi:
        distanceMeters === 0
          ? `Bạn đang ở gần ${destinationNameVi}.`
          : `Từ ${originDetails.label}, hướng ${direction} về phía ${destinationNameVi} (hướng đường thẳng tham khảo).`,
      instructionEn:
        distanceMeters === 0
          ? `You are already near ${destinationNameEn}.`
          : `From ${originDetails.labelEn}, head ${directionEn} toward ${destinationNameEn} (estimated straight-line bearing).`,
      coordinates,
      routeType: "coordinate-estimate",
      isIndoorRoute: false,
      notice:
        "Đây là tuyến tham khảo nối trực tiếp theo tọa độ, không phải sơ đồ lối đi trong nhà. Hãy đi theo biển chỉ dẫn và hướng dẫn của nhân viên tại Dinh Độc Lập.",
    },
  };
}
