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

    'similarity_threshold' => (float) env('FACE_SIMILARITY_THRESHOLD', 90),
];
