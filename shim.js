// Polyfills for Solana Web3.js and Anchor compatibility
import { Buffer } from 'buffer';
import 'react-native-get-random-values';

global.Buffer = Buffer;

// Crypto polyfill
if (typeof global.crypto === 'undefined') {
    global.crypto = {};
}

// Polyfill for structuredClone (needed by Anchor Program)
// React Native doesn't have this built-in, but Anchor's IDL conversion uses it
if (typeof global.structuredClone === 'undefined') {
    global.structuredClone = function structuredClone(obj) {
        // Simple deep clone using JSON serialization
        // This works for JSON-serializable objects (which IDLs are)
        return JSON.parse(JSON.stringify(obj));
    };
}

export { };
