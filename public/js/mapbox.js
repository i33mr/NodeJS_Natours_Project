/* eslint-disable */

export const displayMap = (locations) => {
  mapboxgl.accessToken =
    "pk.eyJ1IjoiaTMzbXIiLCJhIjoiY2t4eXZiOGFwNDBuczJva282Z3dwbDFxbCJ9.rTgvmfNAe8Rtbhqsmtv3cw";

  let map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/i33mr/ckxyvlhnl3hhy14l57dykigh2",
    scrollZoom: false,
    // center: [-118, 34.111],
    // zoom: 10,
    // interactive: false,
  });

  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach((loc) => {
    // Create marker
    const el = document.createElement("div");
    el.className = "marker";

    // Add marker
    new mapboxgl.Marker({
      element: el,
      anchor: "bottom",
    })
      .setLngLat(loc.coordinates)
      .addTo(map);

    // add popup

    new mapboxgl.Popup({
      offset: 30,
    })
      .setLngLat(loc.coordinates)
      .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
      .addTo(map);

    // Extend map bounds to include current location, specify paddings for the map
    bounds.extend(loc.coordinates);
  });

  map.fitBounds(bounds, {
    padding: {
      top: 200,
      bottom: 150,
      left: 100,
      right: 100,
    },
  });
};
