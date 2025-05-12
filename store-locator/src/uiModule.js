// merienda-locator/src/uiModule.js
import { dayOfWeek, isTruckOpen, getLocations, getCurrentUserLocation, fetchNearbyPOIs } from './dataService.js';
// mapModule is passed to initUI and stored in _mapModule

let _appState;
let _mapModule; 

export function showGlobalError(message) {
  const errorBar = document.getElementById('global-error-message-bar');
  const errorTextElement = document.getElementById('global-error-text');
  if (errorBar && errorTextElement) {
    errorTextElement.textContent = message;
    errorBar.classList.remove('hidden');
  } else {
    console.error("Global error display elements not found. Message:", message);
  }
}

export function clearGlobalError() {
  const errorBar = document.getElementById('global-error-message-bar');
  if (errorBar) {
    errorBar.classList.add('hidden');
  }
}

export function populateLocationList() {
  if (!_appState || !_appState.locations) {
    console.error("uiModule: App state or locations not initialized for populateLocationList.");
    showGlobalError("Cannot display locations: data not ready.");
    return;
  }
  const locationListUl = document.getElementById('location-list');
  if (!locationListUl) {
    console.error("Location list 'location-list' not found.");
    showGlobalError("Cannot display locations list UI element missing.");
    return;
  }
  clearGlobalError();
  locationListUl.innerHTML = '';

  const openNowFilter = document.getElementById('open-now-filter');
  const filterActive = openNowFilter ? openNowFilter.checked : false;
  const currentTime = new Date();
  let locationsToDisplay = [..._appState.locations];
  const currentUserLoc = getCurrentUserLocation();

  if (currentUserLoc && google.maps && google.maps.geometry && google.maps.geometry.spherical) {
    locationsToDisplay.forEach(location => {
      const truckLatLng = new google.maps.LatLng(location.lat, location.lng);
      const userLatLng = new google.maps.LatLng(currentUserLoc.lat, currentUserLoc.lng);
      location.distanceFromUser = google.maps.geometry.spherical.computeDistanceBetween(userLatLng, truckLatLng);
    });
    locationsToDisplay.sort((a, b) => a.distanceFromUser - b.distanceFromUser);
  } else {
    locationsToDisplay.forEach(location => { delete location.distanceFromUser; });
  }

  let visibleCount = 0;
  locationsToDisplay.forEach(location => {
    const isOpen = isTruckOpen(location, currentTime);
    if (filterActive && !isOpen) {
      if (location.marker && location.marker.map) location.marker.map = null;
      return;
    }
    if (location.marker) location.marker.map = _appState.map;
    visibleCount++;

    const listItem = document.createElement('li');
    listItem.id = `list-item-${location.id}`;
    listItem.className = 'p-3 bg-white rounded-lg border border-gray-200 hover:border-meriendaOrange hover:shadow-lg focus-within:ring-2 focus-within:ring-meriendaOrange focus-within:ring-offset-1 transition-all duration-300 ease-in-out cursor-pointer flex justify-between items-center group';
    listItem.dataset.id = location.id;
    listItem.tabIndex = 0;

    let contentHTML = `<div class="flex-grow">
                         <span class="font-semibold text-gray-800 group-hover:text-meriendaOrange-dark block text-sm sm:text-base transition-colors">${location.name}</span>`;
    if (location.distanceFromUser !== undefined) {
      const distanceKm = (location.distanceFromUser / 1000).toFixed(1);
      contentHTML += `<span class="text-xs sm:text-sm text-gray-500 group-hover:text-gray-600 transition-colors">${distanceKm} km away</span>`;
    }
    contentHTML += `</div>`;
    const statusAndChevron = document.createElement('div');
    statusAndChevron.className = 'flex items-center ml-2';
    if (isOpen) {
        statusAndChevron.innerHTML += `<span class="text-xs text-green-600 font-semibold mr-2 py-0.5 px-1.5 bg-green-100 rounded-full">Open</span>`;
    } else {
         statusAndChevron.innerHTML += `<span class="text-xs text-red-500 font-semibold mr-2 py-0.5 px-1.5 bg-red-100 rounded-full">Closed</span>`;
    }
    statusAndChevron.innerHTML += `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-meriendaOrange group-hover:text-meriendaOrange-dark transition-colors" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>`;
    listItem.innerHTML = contentHTML;
    listItem.appendChild(statusAndChevron);
    listItem.addEventListener('click', () => handleLocationSelection(location.id, listItem));
    listItem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') handleLocationSelection(location.id, listItem);
    });
    locationListUl.appendChild(listItem);
  });

  if (visibleCount === 0) {
    locationListUl.innerHTML = filterActive ? 
        '<li class="p-3 text-gray-500 text-sm">No food trucks are currently open matching your criteria.</li>' :
        (_appState.locations.length > 0 ? '<li class="p-3 text-gray-500 text-sm">No locations to display.</li>' :
        '<li class="p-3 text-gray-500 text-sm">No food trucks found in the system.</li>');
  }
}

// generatePOIDetailContent function removed as it's no longer needed.

export async function showPoiDetailsInPanel(placeId) {
  const poiDetailsPanel = document.getElementById('poi-details-panel');
  const poiPlaceDetailsComponent = document.getElementById('poi-place-details-component');

  if (!poiDetailsPanel || !poiPlaceDetailsComponent) {
    showGlobalError("POI details panel or component not found in the DOM.");
    return;
  }
  console.log(`showPoiDetailsInPanel called with placeId: ${placeId}`);
  
  try {
    console.log("Attempting to show POI panel and configure component...");
    await customElements.whenDefined('gmp-place-details');
    console.log("<gmp-place-details> element is defined.");
    await poiPlaceDetailsComponent.configureFromPlace({ id: placeId });
    console.log("poiPlaceDetailsComponent.configureFromPlace successful.");
    poiDetailsPanel.classList.remove('hidden');
    console.log("poi-details-panel 'hidden' class removed. Panel should be visible.");
  } catch (error) {
    console.error("Error in showPoiDetailsInPanel:", error);
    showGlobalError(`Could not display POI details: ${error.message}`);
    if (poiDetailsPanel) poiDetailsPanel.classList.add('hidden'); // Ensure it's hidden on error
  }
}

export function hidePoiDetailsPanel() {
  const poiDetailsPanel = document.getElementById('poi-details-panel');
  if (poiDetailsPanel) {
    poiDetailsPanel.classList.add('hidden');
  }
}

async function fetchAndDisplayNearbyPOIs(truckLocation) {
  if (!_mapModule) {
    showGlobalError("Map service not available for POIs.");
    return;
  }
  if (!_appState || !_appState.apiKey) { // Check for apiKey in appState
    showGlobalError("API Key not available for fetching POIs.");
    return;
  }
  clearGlobalError();
  _mapModule.clearPOIMarkers(); // Clear previous POIs from map

  try {
    const nearbyPlaces = await fetchNearbyPOIs(truckLocation); // from dataService
    if (nearbyPlaces && nearbyPlaces.length > 0) {
      // Call displayPOIMarkers with the API key
      await _mapModule.displayPOIMarkers(nearbyPlaces, _appState.apiKey);
    } else {
      console.log("No operational nearby attractions found.");
      // Optionally show a message if no POIs found.
    }
  } catch (error) {
    console.error("Error in fetchAndDisplayNearbyPOIs (uiModule):", error);
    showGlobalError(error.message || "Could not fetch or display nearby places.");
  }
}

export function displayTruckDetailsInSidebar(truckId) {
  if (!_appState || !_appState.locations) {
    showGlobalError("Cannot display truck details: data not ready.");
    return;
  }
  const truckDetailsContent = document.getElementById('truck-details-content');
  if (!truckDetailsContent) {
    showGlobalError("Cannot display truck details UI element missing.");
    return;
  }
  clearGlobalError();
  const location = _appState.locations.find(loc => loc.id === truckId);
  if (!location) {
    truckDetailsContent.innerHTML = '<p class="text-red-600 p-2">Truck details not found.</p>';
    showGlobalError("Selected truck details could not be found.");
    return;
  }

  truckDetailsContent.innerHTML = ''; // Clear previous content
  const nameEl = document.createElement('h4');
  nameEl.className = 'text-lg font-semibold mb-1.5 text-meriendaBrown-dark';
  nameEl.textContent = location.name;
  truckDetailsContent.appendChild(nameEl);

  const addressEl = document.createElement('p');
  addressEl.className = 'text-sm text-gray-600 mb-1';
  addressEl.textContent = location.address;
  truckDetailsContent.appendChild(addressEl);

  if (location.description) {
    const descriptionEl = document.createElement('p');
    descriptionEl.className = 'text-sm text-gray-700 mb-2.5 italic';
    descriptionEl.textContent = location.description;
    truckDetailsContent.appendChild(descriptionEl);
  }

  if (location.opening_hours && Object.keys(location.opening_hours).length > 0) {
    const hoursTitleEl = document.createElement('h5');
    hoursTitleEl.className = 'text-sm font-semibold mt-2.5 mb-1 text-gray-700';
    hoursTitleEl.textContent = 'Operating Hours:';
    truckDetailsContent.appendChild(hoursTitleEl);
    const hoursListEl = document.createElement('ul');
    hoursListEl.className = 'list-none text-xs text-gray-600 mb-2.5 space-y-0.5';
    const today = dayOfWeek[new Date().getDay()];
    for (const day in location.opening_hours) {
      const item = document.createElement('li');
      item.innerHTML = `<span class="font-medium w-20 inline-block ${day === today ? 'text-meriendaOrange-dark' : ''}">${day}:</span> ${location.opening_hours[day]}`;
      hoursListEl.appendChild(item);
    }
    truckDetailsContent.appendChild(hoursListEl);
  } else {
    const noHoursEl = document.createElement('p');
    noHoursEl.className = 'text-xs text-gray-500 mb-2.5';
    noHoursEl.textContent = 'Operating hours not available.';
    truckDetailsContent.appendChild(noHoursEl);
  }
  
  // Explore Nearby button removed, functionality moved to handleLocationSelection
  console.log(`uiModule: Displaying details for truck ID ${truckId}`);
}

export function handleLocationSelection(truckId, listItemElement) {
  if (!_appState || !_appState.locations || !_appState.map || !_mapModule) {
    showGlobalError("Cannot select location: application not fully ready.");
    return;
  }
  const selectedLocation = _appState.locations.find(loc => loc.id === truckId);
  if (selectedLocation && selectedLocation.marker) {
    _mapModule.panToLocation(selectedLocation.marker.position);
    displayTruckDetailsInSidebar(truckId);
    fetchAndDisplayNearbyPOIs(selectedLocation); // Automatically explore nearby

    const locationListItems = document.querySelectorAll('#location-list li');
    locationListItems.forEach(item => {
        item.classList.remove('bg-meriendaOrange-light', 'ring-2', 'ring-meriendaOrange-dark');
        item.classList.add('hover:border-meriendaOrange', 'hover:shadow-lg');
    });
    // Find the list item to highlight, either the one passed in or by ID if clicked on map
    const itemToHighlight = listItemElement || document.getElementById(`list-item-${truckId}`);
    if (itemToHighlight) {
        itemToHighlight.classList.add('bg-meriendaOrange-light', 'ring-2', 'ring-meriendaOrange-dark');
        itemToHighlight.classList.remove('hover:border-meriendaOrange', 'hover:shadow-lg');
        // Always scroll the highlighted item into view
        itemToHighlight.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } else {
      showGlobalError("Selected location could not be displayed on the map.");
  }
}

export function initUI(appStateRef, mapModuleRef) {
  _appState = appStateRef;
  _mapModule = mapModuleRef;

  if (!_appState || !_appState.locations) {
    showGlobalError("Location data not available. UI cannot be fully initialized.");
    return;
  }
  populateLocationList();
  const openNowFilterElement = document.getElementById('open-now-filter');
  if (openNowFilterElement) {
    openNowFilterElement.addEventListener('change', populateLocationList);
  } else {
    console.warn("Open Now filter element not found.");
  }

  const poiPanelCloseButton = document.getElementById('poi-panel-close-button');
  if (poiPanelCloseButton) {
    poiPanelCloseButton.addEventListener('click', hidePoiDetailsPanel);
  } else {
    console.warn("POI panel close button not found.");
  }
  
  // Autocomplete setup removed.
  console.log("uiModule.js initialized (Autocomplete removed, POI integration points remain).");
}

console.log("uiModule.js processed with POI functions.");