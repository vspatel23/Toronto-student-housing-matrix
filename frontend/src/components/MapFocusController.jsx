import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { getMapPointKey } from "../utils/mapPresentation";

function MapFocusController({ coordinates }) {
  const map = useMap();
  const lastFocusedKey = useRef("");

  useEffect(() => {
    if (!coordinates) {
      lastFocusedKey.current = "";
      return;
    }

    const activeKey = getMapPointKey(coordinates);

    if (lastFocusedKey.current === activeKey) {
      return;
    }

    lastFocusedKey.current = activeKey;

    const activePoint = L.latLng(coordinates);
    const visibleBounds = map.getBounds().pad(-0.18);

    if (!visibleBounds.contains(activePoint)) {
      map.panTo(activePoint, {
        animate: true,
        duration: 0.45,
      });
    }
  }, [coordinates, map]);

  return null;
}

export default MapFocusController;
