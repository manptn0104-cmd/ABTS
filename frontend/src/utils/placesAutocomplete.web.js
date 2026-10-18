import { loadGoogleMapsLibrary } from './googleMapsLoader';

let autocompleteService = null;
let placesService = null;
let sessionToken = null;

async function getServices() {
  await loadGoogleMapsLibrary('places');
  const { places } = window.google.maps;
  if (!autocompleteService) autocompleteService = new places.AutocompleteService();
  if (!placesService) placesService = new places.PlacesService(document.createElement('div'));
  if (!sessionToken) sessionToken = new places.AutocompleteSessionToken();
  return { autocompleteService, placesService, places };
}

/**
 * Fetches Google Places Autocomplete predictions for the given text, optionally
 * biased toward a lat/lng (e.g. the user's current location or the pickup point).
 */
export async function fetchPlacePredictions(query, bias) {
  if (!query || query.trim().length < 3) return [];
  try {
    const { autocompleteService, places } = await getServices();
    const request = {
      input: query,
      sessionToken,
      componentRestrictions: { country: 'in' },
    };
    if (bias?.lat != null && bias?.lng != null) {
      request.locationBias = { radius: 50000, center: { lat: bias.lat, lng: bias.lng } };
    }
    return await new Promise((resolve) => {
      autocompleteService.getPlacePredictions(request, (predictions, status) => {
        if (status !== places.PlacesServiceStatus.OK || !predictions) {
          resolve([]);
          return;
        }
        resolve(predictions.map((p) => ({
          placeId: p.place_id,
          label: p.description,
          shortLabel: p.structured_formatting?.main_text || p.description,
        })));
      });
    });
  } catch (err) {
    console.warn('[PlacesAutocomplete:web] prediction error', err);
    return [];
  }
}

/**
 * Resolves a place_id (from fetchPlacePredictions) into a lat/lng + formatted address.
 */
export async function fetchPlaceDetails(placeId) {
  if (!placeId) return null;
  try {
    const { placesService, places } = await getServices();
    return await new Promise((resolve) => {
      placesService.getDetails(
        { placeId, fields: ['geometry', 'formatted_address', 'name'], sessionToken },
        (place, status) => {
          // Start a fresh session now that this autocomplete session has completed
          sessionToken = new places.AutocompleteSessionToken();
          if (status !== places.PlacesServiceStatus.OK || !place?.geometry?.location) {
            resolve(null);
            return;
          }
          resolve({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            formattedAddress: place.formatted_address || place.name,
          });
        }
      );
    });
  } catch (err) {
    console.warn('[PlacesAutocomplete:web] details error', err);
    return null;
  }
}
