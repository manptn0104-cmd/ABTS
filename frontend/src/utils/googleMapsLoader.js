import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { GOOGLE_MAPS_API_KEY } from './constants';

let configured = false;
const libraryPromises = {};

/**
 * Lazily loads a Google Maps JavaScript API library (e.g. 'maps', 'places'),
 * loading each library exactly once and sharing a single underlying script tag
 * across the whole app (web only).
 */
export function loadGoogleMapsLibrary(name) {
  if (!configured) {
    setOptions({ key: GOOGLE_MAPS_API_KEY, v: 'weekly' });
    configured = true;
  }
  if (!libraryPromises[name]) {
    libraryPromises[name] = importLibrary(name);
  }
  return libraryPromises[name];
}
