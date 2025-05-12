// src/main.js (v5 - Dynamic API Loading)
import { fetchLocations, getUserLocation } from './dataService.js';
import * as mapModule from './mapModule.js';
import * as uiModule from './uiModule.js';

// --- Configuration ---
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const MAP_ID = import.meta.env.VITE_MAP_ID;
const GMP_CALLBACK_NAME = 'gmpEntryPoint'; // Unique name for the callback

// --- State ---
let appState = {
  locations: [],
  userLocation: null,
  map: null,
  mapsApiLoaded: false, // Track API loading status
  mapsApiLoadError: null, // Store potential loading error
  apiKey: API_KEY // Add API_KEY to appState
};

// --- API Loading ---
let resolveMapsApiLoaded; // Function to resolve the promise once API loads
const mapsApiPromise = new Promise((resolve, reject) => {
  resolveMapsApiLoaded = resolve; // Assign the resolve function
  // Assign error handling to the promise's reject
  window.gm_authFailure = () => {
      appState.mapsApiLoadError = new Error("Google Maps API authentication failed. Check API key and project configuration.");
      reject(appState.mapsApiLoadError);
  };
});

// Callback function executed once Google Maps API script is loaded
window[GMP_CALLBACK_NAME] = () => {
  console.log("Google Maps API script loaded successfully.");
  appState.mapsApiLoaded = true;
  resolveMapsApiLoaded(); // Resolve the promise
  delete window[GMP_CALLBACK_NAME]; // Clean up global scope
};

function loadMapsApi(apiKey, mapIds, callbackName) {
  if (!apiKey) {
    const error = new Error("VITE_GOOGLE_MAPS_API_KEY is missing in your .env file.");
    appState.mapsApiLoadError = error;
    throw error; // Throw immediately to stop execution
  }
  if (!mapIds) {
      console.warn("VITE_MAP_ID is missing. Cloud-based map styling will not be applied.");
  }

  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&map_ids=${mapIds || ''}&libraries=marker,places,geometry&callback=${callbackName}&v=beta`;
  script.async = true;
  script.defer = true; // Ensure it executes after parsing but non-blocking
  script.onerror = (event) => { // Basic script loading error
      const error = new Error(`Failed to load Google Maps script: ${event.type}`);
      appState.mapsApiLoadError = error;
      console.error(error.message, event);
      // Reject the promise if the script tag itself fails to load
      mapsApiPromise.catch(() => {})(error); // Call reject if not already rejected
  };
  document.head.appendChild(script);
  console.log("Attempting to load Google Maps API...");
}

// --- Application Logic ---
function handleMarkerClick(locationId) {
    console.log(`Marker clicked for location ID: ${locationId} (main.js). Calling uiModule.handleLocationSelection.`);
    uiModule.handleLocationSelection(locationId, null);
}

async function actualAppInitialization(mapId) {
  console.log("actualAppInitialization from src/main.js called (v5)");
  if (!appState.mapsApiLoaded) {
      console.error("Attempted to initialize app before Maps API loaded.");
      uiModule.showGlobalError("Maps API did not load correctly. Please refresh.");
      return;
  }
  if (appState.mapsApiLoadError) {
      console.error("Cannot initialize app due to Maps API load error:", appState.mapsApiLoadError);
      uiModule.showGlobalError(`Failed to load Google Maps: ${appState.mapsApiLoadError.message}`);
      return;
  }

  try {
    appState.locations = await fetchLocations();
    console.log("Locations fetched in main.js:", appState.locations);

    try {
        appState.userLocation = await getUserLocation();
        console.log("User location fetched in main.js:", appState.userLocation);
    } catch (userLocationError) {
        console.warn("Could not get user location on init (main.js):", userLocationError.message);
        // Even if user location fails, proceed to initialize map with default or truck center
    }

    appState.map = await mapModule.initMapInstance(
        'map-area',
        appState.locations,
        undefined, // center (optional, mapModule calculates if needed)
        mapId, // Pass the mapId from env var
        handleMarkerClick
    );
    console.log("Map initialized in main.js:", appState.map ? "Success" : "Failed");

    // Display user location marker if available
    if (appState.userLocation && appState.map) {
      await mapModule.displayUserLocationMarker(appState.userLocation);
      // Optionally pan to user's location if map hasn't centered on a selected truck yet
      // For now, let truck selection or default centering take precedence.
      // If you want to always center on user first:
      // mapModule.panToLocation(appState.userLocation, 14);
    }

    uiModule.initUI(appState, mapModule);
    console.log("uiModule initialized from main.js.");

  } catch (error) {
    console.error("Critical error during actualAppInitialization (v5):", error.message, error.stack);
    // Use the UI module's error display if available
    if (uiModule && uiModule.showGlobalError) {
        uiModule.showGlobalError(`Failed to initialize application: ${error.message}. Please try refreshing.`);
    } else { // Fallback if UI module hasn't loaded or error function isn't exposed
        const errorBar = document.getElementById('global-error-message-bar');
        const errorText = document.getElementById('global-error-text');
        if (errorBar && errorText && errorBar.classList.contains('hidden')) {
            errorText.textContent = `Failed to initialize application: ${error.message}. Please try refreshing.`;
            errorBar.classList.remove('hidden');
        }
    }
  }
}

// --- Initialization Trigger ---
function startApp() {
    console.log("startApp called (v5). Loading Maps API.");
    try {
        loadMapsApi(API_KEY, MAP_ID, GMP_CALLBACK_NAME);

        // Wait for the API to load, then initialize the rest of the app
        mapsApiPromise.then(() => {
            console.log("Maps API Promise resolved. Proceeding with app initialization.");
            actualAppInitialization(MAP_ID); // Pass Map ID
        }).catch(error => {
            console.error("Maps API failed to load:", error);
            // Display error using UI module or fallback
            if (uiModule && uiModule.showGlobalError) {
                uiModule.showGlobalError(`Critical Error: Could not load Google Maps API. ${error.message}`);
            } else {
                 const errorBar = document.getElementById('global-error-message-bar');
                 const errorText = document.getElementById('global-error-text');
                 if (errorBar && errorText && errorBar.classList.contains('hidden')) {
                     errorText.textContent = `Critical Error: Could not load Google Maps API. ${error.message}`;
                     errorBar.classList.remove('hidden');
                 }
            }
        });
    } catch (error) {
         console.error("Error during startApp (e.g., missing API key):", error);
         // Display error using UI module or fallback
         if (uiModule && uiModule.showGlobalError) {
             uiModule.showGlobalError(`Configuration Error: ${error.message}`);
         } else {
              const errorBar = document.getElementById('global-error-message-bar');
              const errorText = document.getElementById('global-error-text');
              if (errorBar && errorText && errorBar.classList.contains('hidden')) {
                  errorText.textContent = `Configuration Error: ${error.message}`;
                  errorBar.classList.remove('hidden');
              }
         }
    }
}

// Start the application process immediately when the module loads
startApp();
