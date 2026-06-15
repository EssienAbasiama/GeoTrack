<?php

namespace App\Services;

use App\Models\FaceProfile;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class FaceMatchService
{
    private string $driver;

    public function __construct()
    {
        $this->driver = $this->resolveDriver();
    }

    public function driver(): string
    {
        return $this->driver;
    }

    /**
     * Enroll a user's reference face.
     *
     * @return array{provider: string, provider_face_id: string|null, image_path: string}
     */
    public function enroll(User $user, string $base64Jpeg): array
    {
        $imagePath = $this->saveImage($user->id, $base64Jpeg);

        if ($this->driver === 'aws_rekognition') {
            try {
                return $this->enrollAws($user, $base64Jpeg, $imagePath);
            } catch (Throwable $e) {
                report($e);
                // Fall back to local hash if AWS fails at runtime.
            }
        }

        return $this->enrollLocal($user, $base64Jpeg, $imagePath);
    }

    /**
     * Verify the given image against the user's enrolled face.
     *
     * @return array{matched: bool, confidence: float, image_path: string|null}
     */
    public function verify(User $user, string $base64Jpeg): array
    {
        $profile = FaceProfile::query()->where('user_id', $user->id)->first();
        if (!$profile) {
            return ['matched' => false, 'confidence' => 0.0, 'image_path' => null];
        }

        $imagePath = $this->saveImage($user->id, $base64Jpeg, 'verify');

        if ($profile->provider === 'aws_rekognition' && $this->driver === 'aws_rekognition') {
            try {
                $result = $this->verifyAws($profile, $base64Jpeg);
                $result['image_path'] = $imagePath;
                return $result;
            } catch (Throwable $e) {
                report($e);
            }
        }

        $result = $this->verifyLocal($profile, $base64Jpeg);
        $result['image_path'] = $imagePath;
        return $result;
    }

    private function resolveDriver(): string
    {
        $configured = config('face.driver');
        if ($configured === 'aws_rekognition' || $configured === 'local_hash') {
            return $configured;
        }

        $hasAwsKey = !empty(env('AWS_ACCESS_KEY_ID')) && !empty(env('AWS_SECRET_ACCESS_KEY'));
        if ($hasAwsKey && class_exists(\Aws\Rekognition\RekognitionClient::class)) {
            return 'aws_rekognition';
        }

        return 'local_hash';
    }

    private function saveImage(int $userId, string $base64Jpeg, string $purpose = 'reference'): string
    {
        $bytes = $this->decodeBase64($base64Jpeg);
        $filename = sprintf('faces/%d/%s-%s.jpg', $userId, $purpose, (string) Str::uuid());
        Storage::disk('public')->put($filename, $bytes);
        return $filename;
    }

    private function decodeBase64(string $base64): string
    {
        if (str_contains($base64, ',')) {
            $base64 = explode(',', $base64, 2)[1] ?? $base64;
        }
        $decoded = base64_decode($base64, true);
        if ($decoded === false) {
            return '';
        }
        return $decoded;
    }

    // ── AWS Rekognition ─────────────────────────────────────────────────────

    /**
     * @return array{provider: string, provider_face_id: string|null, image_path: string}
     */
    private function enrollAws(User $user, string $base64Jpeg, string $imagePath): array
    {
        $client = $this->makeRekognitionClient();
        $collection = (string) config('face.aws_collection', 'geotrack-faces');

        $this->ensureCollection($client, $collection);

        // Remove any previously indexed face for this user.
        $existing = FaceProfile::query()->where('user_id', $user->id)->first();
        if ($existing && $existing->provider_face_id) {
            try {
                $client->deleteFaces([
                    'CollectionId' => $collection,
                    'FaceIds' => [$existing->provider_face_id],
                ]);
            } catch (Throwable $e) {
                report($e);
            }
        }

        $result = $client->indexFaces([
            'CollectionId' => $collection,
            'Image' => ['Bytes' => $this->decodeBase64($base64Jpeg)],
            'ExternalImageId' => 'user_' . $user->id,
            'DetectionAttributes' => ['DEFAULT'],
            'MaxFaces' => 1,
            'QualityFilter' => 'AUTO',
        ]);

        $records = $result->get('FaceRecords') ?? [];
        $faceId = $records[0]['Face']['FaceId'] ?? null;

        FaceProfile::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'reference_image_path' => $imagePath,
                'descriptor' => null,
                'provider' => 'aws_rekognition',
                'provider_face_id' => $faceId,
                'enrolled_at' => now(),
            ]
        );

        return [
            'provider' => 'aws_rekognition',
            'provider_face_id' => $faceId,
            'image_path' => $imagePath,
        ];
    }

    /**
     * @return array{matched: bool, confidence: float}
     */
    private function verifyAws(FaceProfile $profile, string $base64Jpeg): array
    {
        $client = $this->makeRekognitionClient();
        $collection = (string) config('face.aws_collection', 'geotrack-faces');
        $threshold = (float) config('face.similarity_threshold', 90);

        $result = $client->searchFacesByImage([
            'CollectionId' => $collection,
            'Image' => ['Bytes' => $this->decodeBase64($base64Jpeg)],
            'FaceMatchThreshold' => $threshold,
            'MaxFaces' => 3,
        ]);

        $matches = $result->get('FaceMatches') ?? [];
        $best = null;
        foreach ($matches as $match) {
            $sim = (float) ($match['Similarity'] ?? 0);
            if ($best === null || $sim > $best['similarity']) {
                $best = [
                    'similarity' => $sim,
                    'face_id' => $match['Face']['FaceId'] ?? null,
                ];
            }
        }

        if ($best === null) {
            return ['matched' => false, 'confidence' => 0.0];
        }

        $matched = $best['face_id'] === $profile->provider_face_id
            && $best['similarity'] >= $threshold;

        return [
            'matched' => $matched,
            'confidence' => $best['similarity'],
        ];
    }

    private function makeRekognitionClient(): \Aws\Rekognition\RekognitionClient
    {
        return new \Aws\Rekognition\RekognitionClient([
            'version' => 'latest',
            'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
            'credentials' => [
                'key' => env('AWS_ACCESS_KEY_ID'),
                'secret' => env('AWS_SECRET_ACCESS_KEY'),
            ],
        ]);
    }

    private function ensureCollection(\Aws\Rekognition\RekognitionClient $client, string $collection): void
    {
        try {
            $client->describeCollection(['CollectionId' => $collection]);
        } catch (Throwable $e) {
            try {
                $client->createCollection(['CollectionId' => $collection]);
            } catch (Throwable $inner) {
                report($inner);
            }
        }
    }

    // ── Local fallback (perceptual average hash) ────────────────────────────

    /**
     * @return array{provider: string, provider_face_id: string|null, image_path: string}
     */
    private function enrollLocal(User $user, string $base64Jpeg, string $imagePath): array
    {
        $hash = $this->averageHash($this->decodeBase64($base64Jpeg));

        FaceProfile::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'reference_image_path' => $imagePath,
                'descriptor' => ['hash' => $hash],
                'provider' => 'local_hash',
                'provider_face_id' => null,
                'enrolled_at' => now(),
            ]
        );

        return [
            'provider' => 'local_hash',
            'provider_face_id' => null,
            'image_path' => $imagePath,
        ];
    }

    /**
     * @return array{matched: bool, confidence: float}
     */
    private function verifyLocal(FaceProfile $profile, string $base64Jpeg): array
    {
        $reference = $profile->descriptor['hash'] ?? null;
        if (!is_string($reference) || $reference === '') {
            return ['matched' => false, 'confidence' => 0.0];
        }

        $candidate = $this->averageHash($this->decodeBase64($base64Jpeg));
        if ($candidate === '') {
            return ['matched' => false, 'confidence' => 0.0];
        }

        $distance = $this->hammingDistance($reference, $candidate);
        $confidence = max(0.0, 100.0 - ($distance / 256.0 * 100.0));

        // The local average-hash is coarse (it compares whole-image structure,
        // not facial identity), so two genuine selfies can differ by a wide
        // margin. The accept distance is therefore configurable; tune
        // FACE_LOCAL_MATCH_DISTANCE for your environment, or enable AWS
        // Rekognition for real face matching.
        $maxDistance = (int) config('face.local_match_distance', 96);

        return [
            'matched' => $distance <= $maxDistance,
            'confidence' => $confidence,
        ];
    }

    /**
     * Compute a 256-bit average hash from a JPEG byte string using GD.
     * Returns a binary string of 64 hex characters (256 bits) or empty on failure.
     */
    private function averageHash(string $jpegBytes): string
    {
        if ($jpegBytes === '' || !function_exists('imagecreatefromstring')) {
            return '';
        }

        $img = @imagecreatefromstring($jpegBytes);
        if (!$img) {
            return '';
        }

        $size = 16; // 16x16 = 256 pixels = 256 bits
        $small = imagecreatetruecolor($size, $size);
        imagecopyresampled($small, $img, 0, 0, 0, 0, $size, $size, imagesx($img), imagesy($img));
        imagedestroy($img);

        $sum = 0;
        $pixels = [];
        for ($y = 0; $y < $size; $y++) {
            for ($x = 0; $x < $size; $x++) {
                $rgb = imagecolorat($small, $x, $y);
                $r = ($rgb >> 16) & 0xFF;
                $g = ($rgb >> 8) & 0xFF;
                $b = $rgb & 0xFF;
                $gray = (int) round(0.299 * $r + 0.587 * $g + 0.114 * $b);
                $pixels[] = $gray;
                $sum += $gray;
            }
        }
        imagedestroy($small);

        $avg = $sum / ($size * $size);
        $bits = '';
        foreach ($pixels as $value) {
            $bits .= $value >= $avg ? '1' : '0';
        }

        // Convert 256-bit binary string to 64-char hex.
        $hex = '';
        for ($i = 0; $i < 256; $i += 4) {
            $hex .= dechex(bindec(substr($bits, $i, 4)));
        }
        return $hex;
    }

    private function hammingDistance(string $hashA, string $hashB): int
    {
        $lenA = strlen($hashA);
        $lenB = strlen($hashB);
        $len = min($lenA, $lenB);
        if ($len === 0) {
            return 256;
        }

        $distance = 0;
        for ($i = 0; $i < $len; $i++) {
            $a = hexdec($hashA[$i]);
            $b = hexdec($hashB[$i]);
            $xor = $a ^ $b;
            // Count set bits in the 4-bit nibble.
            $distance += [0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4][$xor];
        }
        // Add max-penalty for any length mismatch.
        $distance += abs($lenA - $lenB) * 4;
        return $distance;
    }
}
