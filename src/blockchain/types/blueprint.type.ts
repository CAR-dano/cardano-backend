/**
 * Mendefinisikan struktur data untuk objek validator
 * yang ada di dalam file plutus.json dari Aiken.
 */
export interface PlutusValidator {
  title: string;
  compiledCode: string;
  hash: string;
  // Tambahkan properti lain jika diperlukan, seperti 'parameters', 'redeemer', dll.
}

/**
 * Mendefinisikan struktur data utama dari file plutus.json.
 */
export interface PlutusBlueprint {
  preamble: {
    title: string;
    version: string;
    // ...properti lain di preamble
  };
  validators: PlutusValidator[];
  definitions: Record<string, any>;
}
