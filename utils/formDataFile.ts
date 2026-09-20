import { File } from 'expo-file-system';

/**
 * Append a local file (file:// URI) to FormData in a way Expo's WinterCG
 * fetch can serialize.
 *
 * The classic React Native `{ uri, name, type }` part throws
 * "Unsupported FormDataPart implementation" under Expo SDK's global fetch --
 * its converter only understands strings, Blobs, or objects exposing
 * `bytes()` (see expo/src/winter/fetch/convertFormData.ts, which says so
 * in as many words: "`uri` is not supported for React Native's FormData").
 * expo-file-system's File wraps the local file and implements the Blob
 * interface (including `bytes()`, `name`, and a `type` derived from the
 * extension), which the converter streams correctly.
 *
 * Same helper as markt_mobile's utils/formDataFile.ts -- the buyer app hit
 * this first. Kept as a copy rather than shared because the two apps have
 * no common package to put it in.
 */
export function appendLocalFile(
  formData: FormData,
  field: string,
  uri: string,
  filename?: string
) {
  const file = new File(uri);
  formData.append(field, file as unknown as Blob, filename ?? file.name);
}
