// merienda-locator/src/dataService.js

let _allLocations = [];
let _currentUserLocation = null;

export const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function fetchLocations() {
  try {
    const response = await fetch('./data/locations.json'); // Use relative path
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}. Failed to load food truck data.`);
    }
    const locations = await response.json();
    if (!locations || locations.length === 0) {
      throw new Error("No food truck locations were found in the data source.");
    }
    _allLocations = locations;
    return [..._allLocations];
  } catch (error) {
    console.error("Could not fetch locations:", error);
    throw error;
  }
}

export function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        _currentUserLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        resolve({..._currentUserLocation});
      },
      (error) => {
        let consoleMessage = "Error getting user location: ";
        switch (error.code) {
          case error.PERMISSION_DENIED: consoleMessage += "User denied the request for Geolocation."; break;
          case error.POSITION_UNAVAILABLE: consoleMessage += "Location information is unavailable."; break;
          case error.TIMEOUT: consoleMessage += "The request to get user location timed out."; break;
          default: consoleMessage += "An unknown error occurred."; break;
        }
        console.error(consoleMessage, error);
        reject(new Error(consoleMessage));
      }
    );
  });
}

export function isTruckOpen(truckLocation, currentTime) {
  if (!truckLocation.opening_hours) return false;
  const currentDayName = dayOfWeek[currentTime.getDay()];
  const hoursToday = truckLocation.opening_hours[currentDayName];
  if (!hoursToday || hoursToday.toLowerCase() === 'closed') return false;
  try {
    const [openStr, closeStr] = hoursToday.split('-');
    if (!openStr || !closeStr) return false;
    const openTime = new Date(currentTime);
    const [openHours, openMinutes] = openStr.split(':').map(Number);
    openTime.setHours(openHours, openMinutes, 0, 0);
    const closeTime = new Date(currentTime);
    const [closeHours, closeMinutes] = closeStr.split(':').map(Number);
    closeTime.setHours(closeHours, closeMinutes, 0, 0);
    return currentTime >= openTime && currentTime < closeTime;
  } catch (e) {
    console.error("Error parsing opening hours for", truckLocation.name, ":", hoursToday, e);
    return false;
  }
}

export async function fetchNearbyPOIs(truckLocation) {
  if (!google.maps.places || !google.maps.places.Place) {
    throw new Error("Google Maps Places Service is not available. Cannot fetch POIs.");
  }
  try {
    await google.maps.importLibrary("places"); 
  } catch (e) {
    throw new Error("Failed to load Google Maps Places library.");
  }

  const searchNearbyRequest = {
    locationRestriction: {
      center: { lat: truckLocation.lat, lng: truckLocation.lng },
      radius: 750,
    },
    includedPrimaryTypes: ['park', 'tourist_attraction', 'cafe', 'restaurant', 'shopping_mall'],
    // Corrected: Removed 'place_id' as it's not a valid field for searchNearby's 'fields' array.
    // 'id' (which is the place_id) is returned by default.
    fields: ['displayName', 'location', 'types', 'formattedAddress', 'photos', 'rating', 'userRatingCount', 'businessStatus'],
    maxResultCount: 7,
  };

  try {
    const { places: nearbyPlaces } = await google.maps.places.Place.searchNearby(searchNearbyRequest);
    // Filter for operational places that have a location.
    return nearbyPlaces.filter(place => place.businessStatus === 'OPERATIONAL' && place.location);
  } catch (error) {
    console.error("Error fetching nearby POIs from dataService:", error);
    throw new Error(`Could not find nearby places: ${error.message || "An unknown error occurred."}`);
  }
}

export function getLocations() {
    return [..._allLocations];
}

export function getCurrentUserLocation() {
    return _currentUserLocation ? {..._currentUserLocation} : null;
}

console.log("dataService.js processed with POI function (v2 - fields corrected).");