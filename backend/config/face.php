<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Face Match Driver
    |--------------------------------------------------------------------------
    |
    | Supported: "aws_rekognition", "local_hash", null (auto).
    | When null, the FaceMatchService auto-selects AWS Rekognition if both
    | AWS credentials are present AND the AWS SDK is installed; otherwise
    | falls back to local average-hash matching via GD.
    |
    */
    'driver' => env('FACE_DRIVER', null),

    'aws_collection' => env('FACE_COLLECTION', 'geotrack-faces'),

    // AWS Rekognition similarity threshold (0–100). Genuine faces typically
    // score 90+; impostors well below.
    'similarity_threshold' => (float) env('FACE_SIMILARITY_THRESHOLD', 90),

    // Local average-hash accept distance (0–256 bits). The local driver is a
    // coarse fallback that compares whole-image structure rather than facial
    // identity, so genuine selfies can differ by a wide margin. Lower = stricter
    // (more false rejections), higher = more lenient. Calibrate to your camera
    // and lighting, or enable AWS Rekognition for real face matching.
    'local_match_distance' => (int) env('FACE_LOCAL_MATCH_DISTANCE', 110),
];
