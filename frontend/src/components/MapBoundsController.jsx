import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { fitMapToLocations } from "../utils/mapBounds";

function MapBoundsController({ points, pointsKey }) {
  const map = useMap();
  const lastFitKey = useRef("");

  useEffect(() => {
    if (lastFitKey.current === pointsKey || points.length === 0) {
      return;
    }

    lastFitKey.current = pointsKey;
    fitMapToLocations(map, points);
  }, [map, points, pointsKey]);

  return null;
}

export default MapBoundsController;
