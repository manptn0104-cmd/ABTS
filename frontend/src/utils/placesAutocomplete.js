import { GOOGLE_MAPS_API_KEY } from './constants';

const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

/**
 * Fetches Google Places Autocomplete predictions via the Places Web Service REST API.
 * Native apps aren't subject to browser CORS restrictions, so a direct REST call works
 * here (the web platform uses the Maps JavaScript API instead — see placesAutocomplete.web.js).
 */
export async function fetchPlacePredictions(query, bias) {
  if (!query || query.trim().length < 3) return [];
  try {
    const params = new URLSearchParams({
      input: query,
      key: GOOGLE_MAPS_API_KEY,
      components: 'country:in',
    });
    if (bias?.lat != null && bias?.lng != null) {
      params.set('location', `${bias.lat},${bias.lng}`);
      params.set('radius', '50000');
    }
    const res = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`);
    const data = await res.json();
    if (data.status !== 'OK') return [];
    return data.predictions.map((p) => ({
      placeId: p.place_id,
      label: p.description,
      shortLabel: p.structured_formatting?.main_text || p.description,
    }));
  } catch (err) {
    console.warn('[PlacesAutocomplete:native] prediction error', err);
    return [];
  }
}

/**
 * Resolves a place_id (from fetchPlacePredictions) into a lat/lng + formatted address.
 */
export async function fetchPlaceDetails(placeId) {
  if (!placeId) return null;
  try {
    const params = new URLSearchParams({
      place_id: placeId,
      key: GOOGLE_MAPS_API_KEY,
      fields: 'geometry,formatted_address,name',
    });
    const res = await fetch(`${DETAILS_URL}?${params.toString()}`);
    const data = await res.json();
    if (data.status !== 'OK' || !data.result?.geometry?.location) return null;
    return {
      lat: data.result.geometry.location.lat,
      lng: data.result.geometry.location.lng,
      formattedAddress: data.result.formatted_address || data.result.name,
    };
  } catch (err) {
    console.warn('[PlacesAutocomplete:native] details error', err);
    return null;
  }
}
