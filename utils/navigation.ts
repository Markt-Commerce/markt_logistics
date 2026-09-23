import { Alert, Linking, Platform } from 'react-native';

/**
 * Hand a stop to the phone's own maps app.
 *
 * A rider had an address on screen and no way to act on it: reading it
 * out, switching apps and typing it in, at a junction, one-handed. The
 * coordinate is already on the stop -- it is what draws the pin -- so
 * the only thing missing was somewhere to tap.
 *
 * Coordinates rather than the address string wherever we have them. A
 * shop address here is a line a seller typed, and handing "12 Adeola
 * Odeku Street (or 32 Allen Avenue)" to a geocoder is how a rider ends
 * up two miles away with confidence. The text is only a fallback for
 * the stops that genuinely have no pin.
 */

interface Destination {
  coords?: { lat: number; lng: number } | null;
  /** Shown in the maps app, and used to search when there is no pin. */
  label?: string | null;
}

/** Turn-by-turn where the platform offers it, a dropped pin otherwise. */
function urlsFor({ coords, label }: Destination): string[] {
  // encodeURIComponent leaves brackets alone, and Android's geo: scheme
  // ends its label at the first ")". A shop address here is a line a
  // seller typed -- "12 Adeola Odeku Street (or 32 Allen Avenue)" is a
  // real one on the test data -- so the label would be cut in half.
  const name = encodeURIComponent((label || 'Delivery stop').trim())
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');

  if (coords) {
    const point = `${coords.lat},${coords.lng}`;
    if (Platform.OS === 'ios') {
      return [
        // Apple Maps, driving directions from where they are.
        `maps://?daddr=${point}&dirflg=d`,
        `http://maps.apple.com/?daddr=${point}&dirflg=d`,
      ];
    }
    return [
      // Starts navigation outright rather than opening a map of the
      // place, which is what a rider on a bike actually wants.
      `google.navigation:q=${point}`,
      `geo:${point}?q=${point}(${name})`,
      `https://www.google.com/maps/dir/?api=1&destination=${point}`,
    ];
  }

  if (!label) return [];

  // No pin on this stop. Search the text and let the rider judge the
  // result, which is the honest version of not knowing exactly.
  return Platform.OS === 'ios'
    ? [`maps://?q=${name}`, `http://maps.apple.com/?q=${name}`]
    : [`geo:0,0?q=${name}`, `https://www.google.com/maps/search/?api=1&query=${name}`];
}

export function canNavigateTo(destination: Destination): boolean {
  return !!destination.coords || !!destination.label;
}

/**
 * Opens the first URL the phone will accept.
 *
 * Tried in order because the good ones are app schemes that only work
 * if that app is installed -- a rider without Google Maps still gets
 * the browser rather than a button that does nothing.
 */
export async function openDirections(destination: Destination): Promise<void> {
  const candidates = urlsFor(destination);

  for (const url of candidates) {
    try {
      // canOpenURL is unreliable for https on some Android builds, so
      // the web fallback is always attempted rather than asked about.
      if (url.startsWith('http') || (await Linking.canOpenURL(url))) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // Try the next one. A scheme this phone dislikes is not an error
      // worth showing anybody.
    }
  }

  Alert.alert(
    'No maps app',
    'This phone has no maps app that can take the address.'
  );
}
