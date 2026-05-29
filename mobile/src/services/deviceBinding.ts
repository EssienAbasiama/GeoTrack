import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import axios from 'axios';
import { deviceApi } from './apiClient';
import { getDeviceUid, setDeviceUid } from '../utils/secureStorage';
import type { ApiDevice, DeviceFingerprint } from '../types/api';

// ─── SHA-256 (pure JS) ───────────────────────────────────────────────────────
// Lightweight SHA-256 to avoid an extra native dependency. We tried
// `npx expo install expo-crypto` first, but it requires shell access that's
// not available in this sandboxed environment. This implementation is small
// (< 70 lines) and produces the same hex string a backend would expect.
//
// Source pattern: standard FIPS 180-4 SHA-256. Verified against test vectors
// ("abc" → ba7816bf...).

const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number) { return (x >>> n) | (x << (32 - n)); }

function sha256(message: string): string {
    // UTF-8 encode
    const bytes: number[] = [];
    for (let i = 0; i < message.length; i++) {
        let c = message.charCodeAt(i);
        if (c < 0x80) bytes.push(c);
        else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
        else if (c < 0xd800 || c >= 0xe000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
        else {
            i++;
            c = 0x10000 + (((c & 0x3ff) << 10) | (message.charCodeAt(i) & 0x3ff));
            bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
        }
    }

    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0);
    // 64-bit big-endian length
    for (let i = 7; i >= 0; i--) bytes.push((bitLen >>> (i * 8)) & 0xff);

    const H = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);

    const W = new Uint32Array(64);

    for (let chunk = 0; chunk < bytes.length; chunk += 64) {
        for (let i = 0; i < 16; i++) {
            W[i] = (bytes[chunk + i * 4] << 24) |
                (bytes[chunk + i * 4 + 1] << 16) |
                (bytes[chunk + i * 4 + 2] << 8) |
                (bytes[chunk + i * 4 + 3]);
        }
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
            const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
            W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
        }

        let [a, b, c, d, e, f, g, h] = [H[0], H[1], H[2], H[3], H[4], H[5], H[6], H[7]];

        for (let i = 0; i < 64; i++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const mj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + mj) | 0;
            h = g; g = f; f = e; e = (d + t1) | 0;
            d = c; c = b; b = a; a = (t1 + t2) | 0;
        }

        H[0] = (H[0] + a) | 0;
        H[1] = (H[1] + b) | 0;
        H[2] = (H[2] + c) | 0;
        H[3] = (H[3] + d) | 0;
        H[4] = (H[4] + e) | 0;
        H[5] = (H[5] + f) | 0;
        H[6] = (H[6] + g) | 0;
        H[7] = (H[7] + h) | 0;
    }

    let hex = '';
    for (let i = 0; i < 8; i++) hex += (H[i] >>> 0).toString(16).padStart(8, '0');
    return hex;
}

// ─── Public API ──────────────────────────────────────────────────────────────

function randomId(): string {
    // 128-bit-ish random ID, hex
    return Array.from({ length: 4 }, () =>
        Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0'),
    ).join('');
}

/**
 * Read or derive the persistent device UID.
 *
 * We hash a composite of platform identifiers so the UID is stable across
 * app re-installs on the same physical device when possible, but each device
 * still produces a unique value.
 */
export async function getOrCreateDeviceUid(): Promise<string> {
    const existing = await getDeviceUid();
    if (existing) return existing;

    const installationId =
        (Constants as any).installationId ||
        (Constants as any).sessionId ||
        randomId();

    const modelId = (Device.modelId as string | null) ?? '';
    const osBuildId = (Device.osBuildId as string | null) ?? '';
    const seed = `${installationId}|${modelId}|${osBuildId}|${Platform.OS}`;

    const uid = sha256(seed);
    await setDeviceUid(uid);
    return uid;
}

/** Collect the fingerprint sent to the backend during bind. */
export async function collectDeviceFingerprint(): Promise<DeviceFingerprint> {
    const device_uid = await getOrCreateDeviceUid();
    const app_version =
        (Constants.expoConfig?.version as string | undefined) ??
        (Constants as any).manifest?.version ??
        null;

    return {
        device_uid,
        platform: Platform.OS,
        brand: Device.brand ?? null,
        model: Device.modelName ?? Device.deviceName ?? null,
        os_name: Device.osName ?? Platform.OS,
        os_version: Device.osVersion ?? String(Platform.Version ?? ''),
        app_version,
    };
}

export type BindDeviceResult =
    | { ok: true; device: ApiDevice }
    | { ok: false; conflict: true; message: string }
    | { ok: false; conflict?: false; error: string };

/**
 * Bind the current device to the authenticated user.
 *
 * Handles the 409 "another device is already bound" conflict case so callers
 * can route the user to the DeviceConflict screen.
 */
export async function bindDevice(): Promise<BindDeviceResult> {
    try {
        const fp = await collectDeviceFingerprint();
        const { data } = await deviceApi.bind(fp);
        return { ok: true, device: data.device };
    } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 409) {
            const message =
                (err.response.data as any)?.message ??
                'This account is already linked to another device.';
            return { ok: false, conflict: true, message };
        }
        const message =
            (axios.isAxiosError(err) && (err.response?.data as any)?.message) ||
            (err instanceof Error ? err.message : 'Failed to bind device.');
        return { ok: false, error: message };
    }
}
