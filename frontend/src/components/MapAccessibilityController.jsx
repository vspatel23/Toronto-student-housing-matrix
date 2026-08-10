import { useEffect } from "react";
import { useMap } from "react-leaflet";

function MapAccessibilityController({ label, isBusy = false }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    container.setAttribute("aria-label", label);
    container.setAttribute("role", "region");

    if (isBusy) {
      container.setAttribute("aria-busy", "true");
    } else {
      container.removeAttribute("aria-busy");
    }

    return () => {
      container.removeAttribute("aria-busy");
      container.removeAttribute("aria-label");
      container.removeAttribute("role");
    };
  }, [isBusy, label, map]);

  return null;
}

export default MapAccessibilityController;
