<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GeoTrack Security Code</title>
</head>

<body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:24px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                    style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px;">
                    <tr>
                        <td>
                            <h1 style="margin:0 0 10px 0;font-size:22px;line-height:1.3;color:#1f2937;">GeoTrack</h1>
                            <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                                @if ($purpose === 'password_reset')
                                    Use the code below to reset your password.
                                @else
                                    Use the code below to verify your email address.
                                @endif
                            </p>

                            <div
                                style="margin:20px 0;padding:16px;border-radius:10px;background:#eef2ff;text-align:center;">
                                <span
                                    style="display:inline-block;font-size:30px;letter-spacing:8px;font-weight:700;color:#3730a3;">{{ $code }}</span>
                            </div>

                            <p style="margin:0 0 6px 0;font-size:13px;line-height:1.6;color:#6b7280;">
                                This code expires in {{ $ttlMinutes }} minutes.
                            </p>
                            <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
                                If you did not request this, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

</html>
