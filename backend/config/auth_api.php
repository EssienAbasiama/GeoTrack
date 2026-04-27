<?php

return [
    'access_token_ttl_minutes' => env('AUTH_ACCESS_TOKEN_TTL_MINUTES', 15),
    'refresh_token_ttl_days' => env('AUTH_REFRESH_TOKEN_TTL_DAYS', 30),
    'verification_code_ttl_minutes' => env('AUTH_VERIFICATION_CODE_TTL_MINUTES', 10),
    'password_reset_code_ttl_minutes' => env('AUTH_PASSWORD_RESET_CODE_TTL_MINUTES', 10),
];
