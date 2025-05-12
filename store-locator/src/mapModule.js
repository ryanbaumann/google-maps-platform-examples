// store-locator/src/mapModule.js
// Image is now served from public directory, no JS import needed here.

let map; // Internal map instance
let poiMarkers = []; // To store POI markers for easy removal
let poiInfoWindow; // Single InfoWindow for POIs
let userLocationMarker; // Marker for the user's current location

// API Key will be passed as an argument where needed.

export async function initMapInstance(
  mapContainerId,
  locationsData = [],
  defaultCenter = { lat: 37.7749, lng: -122.4194 },
  mapIdValue,
  onMarkerClickCallback
) {
  const mapDiv = document.getElementById(mapContainerId);
  if (!mapDiv) {
    throw new Error(`Map container '${mapContainerId}' not found.`);
  }

  let initialCenter = defaultCenter;
  // Don't center on first truck initially, let user location or default guide it
  // if (locationsData.length > 0) {
  //   initialCenter = { lat: locationsData[0].lat, lng: locationsData[0].lng };
  // }

  try {
    const { Map } = await google.maps.importLibrary("maps");
    map = new Map(mapDiv, {
      center: initialCenter,
      zoom: 12,
      mapId: mapIdValue,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      restriction: {
        latLngBounds: {
          north: 37.8,
          south: 37.55,
          east: -122.40,
          west: -122.,
        },
        strictBounds: true,
      },
    });

    // Add listener to close InfoWindow when map is clicked
    map.addListener('click', () => {
      if (poiInfoWindow) {
        poiInfoWindow.close();
      }
    });

    if (locationsData.length > 0) {
      await displayTruckMarkers(map, locationsData, onMarkerClickCallback);
    }
    console.log("mapModule.js: Map instance created and truck markers displayed.");
    return map;
  } catch (e) {
    console.error("Error creating Google Map object in mapModule:", e);
    throw new Error(`Failed to initialize the map: ${e.message}`);
  }
}

async function displayTruckMarkers(mapInstance, locationsData, onMarkerClickCallback) {
  if (!google.maps.marker || !google.maps.marker.AdvancedMarkerElement) {
    const errorMsg = "AdvancedMarkerElement is not available for truck markers.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

  locationsData.forEach(location => {
    const markerContent = document.createElement('div');
    // Remove pointer-events-none to re-enable hover effects
    markerContent.className = 'p-1 bg-meriendaOrange rounded-full shadow-lg hover:scale-110 transition-transform duration-150';
    const logoImageElement = document.createElement('img');
    // Set class and alt first
    logoImageElement.className = 'w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-white';
    logoImageElement.alt = location.name + " logo";
    // Set src *after* creating the element - Use relative path for base: './'
    logoImageElement.src = 'images/merienda-logo.jpeg';
    markerContent.appendChild(logoImageElement);

    const advancedMarker = new AdvancedMarkerElement({
      map: mapInstance,
      position: { lat: location.lat, lng: location.lng },
      content: markerContent,
      title: location.name,
      gmpClickable: true, // Explicitly enable click events for the truck marker
      zIndex: 20 // Increase zIndex for truck markers to be above POIs
    });
    location.marker = advancedMarker;
    if (onMarkerClickCallback) {
      // Use addEventListener for gmp-click with Advanced Markers
      advancedMarker.addEventListener('gmp-click', () => onMarkerClickCallback(location.id));
    }
  });
}

export function panToLocation(position, zoom = 15) {
  if (map && position) {
    map.moveCamera({ center: position, zoom: zoom }, { duration: 500 });
  } else {
    console.warn("Map not initialized or position not provided for panToLocation.");
  }
}

// --- User Location Marker ---
export async function displayUserLocationMarker(position) {
    if (!map) {
        console.warn("Map not initialized, cannot display user location marker.");
        return;
    }
    if (!google.maps.marker || !google.maps.marker.AdvancedMarkerElement) {
        console.error("AdvancedMarkerElement library not loaded for user marker.");
        return;
    }
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    // Simple blue dot for user location
    const userMarkerContent = document.createElement('div');
    userMarkerContent.style.width = '20px'; // Increased from 16px
    userMarkerContent.style.height = '20px'; // Increased from 16px
    userMarkerContent.style.borderRadius = '50%';
    userMarkerContent.style.backgroundColor = '#4285F4'; // Google Blue
    userMarkerContent.style.border = '4px solid white'; // Increased border for visibility
    userMarkerContent.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)'; // Slightly stronger shadow

    if (userLocationMarker) {
        // Update existing marker position
        userLocationMarker.position = position;
        console.log("mapModule.js: Updated user location marker position.");
    } else {
        // Create new marker
        userLocationMarker = new AdvancedMarkerElement({
            map: map,
            position: position,
            content: userMarkerContent,
            title: 'Your Location',
            zIndex: 10 // Lower than POIs and trucks
        });
        console.log("mapModule.js: Created user location marker.");
    }

    // Optionally pan the map to the user's location the first time it's added
    // panToLocation(position, 14); // Zoom level 14 might be appropriate
}


// --- POI Marker and InfoWindow Management ---

/**
 * Clears all existing POI markers from the map and closes the POI InfoWindow.
 */
export function clearPOIMarkers() {
  poiMarkers.forEach(marker => marker.map = null); // Remove markers from map
  poiMarkers = []; // Clear the array
  console.log("mapModule.js: POI markers cleared.");
}

/**
 * Displays POI markers on the map and sets up their InfoWindows using <gmp-place-details>.
 * @param {Array<Object>} poiData - Array of PlaceResult objects for POIs. Each should have an 'id' (Place ID).
 * @param {string} apiKeyParam - The Google Maps API Key.
 */
export async function displayPOIMarkers(poiData, apiKeyParam) {
  if (!map) {
    console.error("mapModule.js: Map not initialized. Cannot display POI markers.");
    return;
  }
  if (!google.maps.marker || !google.maps.marker.AdvancedMarkerElement) {
    const errorMsg = "AdvancedMarkerElement is not available for POI markers.";
    console.error(errorMsg);
    return;
  }
  // We need InfoWindow from the maps library
  const { InfoWindow } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  // No longer need PlaceDetailsElement logic here

  // Initialize the shared InfoWindow if it doesn't exist
  if (!poiInfoWindow) {
    poiInfoWindow = new InfoWindow({
      pixelOffset: new google.maps.Size(0, -10), // Adjust offset slightly
      maxWidth: 350, // Set a max width
    });
  }

  clearPOIMarkers();

  poiData.forEach(placeResult => {
    if (!placeResult.location || !placeResult.id) {
        console.warn("POI missing location or id (Place ID):", placeResult);
        return;
    }

    const poiMarkerPin = document.createElement('div');
    // Add hover and transition classes, remove direct pointer-events style
    poiMarkerPin.className = 'w-8 h-8 bg-teal-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-sm font-bold hover:scale-110 transition-transform duration-150';
    // poiMarkerPin.style.pointerEvents = 'none'; // Remove this line
    if (placeResult.types.includes('park')) poiMarkerPin.innerHTML = 'P';
    else if (placeResult.types.includes('restaurant')) poiMarkerPin.innerHTML = 'R';
    else if (placeResult.types.includes('cafe')) poiMarkerPin.innerHTML = 'C';
    else poiMarkerPin.innerHTML = '&#x2605;';
    poiMarkerPin.title = placeResult.displayName;
    
    const poiMarker = new AdvancedMarkerElement({
      map: map,
      position: placeResult.location,
      content: poiMarkerPin,
      title: placeResult.displayName,
      gmpClickable: true, // Explicitly set gmpClickable
      zIndex: 15 // Keep POI zIndex lower than truck markers
    });
    poiMarkers.push(poiMarker);

    poiMarker.addEventListener('gmp-click', () => {
      console.log(`POI marker clicked: ${placeResult.displayName}, ID: ${placeResult.id}`);
      // Call the new function to fetch details and display in InfoWindow
      fetchAndDisplayPlaceDetails(placeResult.id, poiMarker, apiKeyParam); // Pass apiKeyParam
    });
  });
  console.log(`mapModule.js: Displayed ${poiMarkers.length} POI markers with fetch-based InfoWindows.`);
}

// --- New Function: Fetch Place Details and Show in InfoWindow ---
async function fetchAndDisplayPlaceDetails(placeId, anchorMarker, apiKeyParam) {
  if (!poiInfoWindow || !map || !apiKeyParam) { // Check apiKeyParam
    console.error("InfoWindow, Map, or API Key not available for fetching details.");
    return;
  }

  // Set loading state
  poiInfoWindow.setContent('<div style="padding: 10px;">Loading details...</div>');
  poiInfoWindow.open({ anchor: anchorMarker, map: map });

  const fields = 'id,displayName,formattedAddress,rating,websiteUri,regularOpeningHours,userRatingCount'; // Added userRatingCount
  const url = `https://places.googleapis.com/v1/places/${placeId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKeyParam, // Use apiKeyParam
        'X-Goog-FieldMask': fields
      }
    });

    if (!response.ok) {
      let errorDetails = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorDetails = errorData.error?.message || JSON.stringify(errorData);
      } catch (e) { /* Ignore parsing error */ }
      throw new Error(`Places API fetch failed: ${errorDetails}`);
    }

    const place = await response.json();

    // Build HTML content for the InfoWindow
    let contentString = '<div style="font-family: Arial, sans-serif; font-size: 14px; max-width: 300px; padding: 5px;">'; // Added padding
    contentString += `<strong style="font-size: 16px; display: block; margin-bottom: 5px;">${place.displayName?.text || 'N/A'}</strong>`; // Block display
    contentString += `<p style="margin: 5px 0;">${place.formattedAddress || ''}</p>`;
    if (place.rating) {
      const ratingCount = place.userRatingCount ? ` (${place.userRatingCount} reviews)` : '';
      contentString += `<p style="margin: 5px 0;">Rating: ${place.rating.toFixed(1)} ★${ratingCount}</p>`; // Show rating count
    }
     if (place.regularOpeningHours?.openNow !== undefined) {
        const isOpen = place.regularOpeningHours.openNow;
        const statusText = isOpen ? 'Open Now' : 'Closed';
        const statusColor = isOpen ? 'green' : 'red';
        contentString += `<p style="margin: 5px 0; color: ${statusColor}; font-weight: bold;">${statusText}</p>`;
    }
    if (place.websiteUri) {
      // Ensure URL has protocol for the link
      let websiteUrl = place.websiteUri;
      if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
          websiteUrl = 'http://' + websiteUrl; // Default to http if missing
      }
      contentString += `<p style="margin: 5px 0;"><a href="${websiteUrl}" target="_blank" rel="noopener noreferrer">Website</a></p>`; // Added rel attribute
    }
    contentString += '</div>';

    poiInfoWindow.setContent(contentString);
    // Re-open might not be necessary if content is updated while open, but doesn't hurt.
    poiInfoWindow.open({ anchor: anchorMarker, map: map });

  } catch (error) {
    console.error('Error fetching or displaying place details:', error);
    poiInfoWindow.setContent(`<div style="color: red; padding: 10px;">Could not load details.<br><small>${error.message}</small></div>`); // Added padding and small tag
    poiInfoWindow.open({ anchor: anchorMarker, map: map });
  }
}


console.log("mapModule.js processed with POI functions and fetch-based InfoWindow logic.");