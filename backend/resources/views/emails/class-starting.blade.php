<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Class starting soon</title>
</head>
<body style="margin:0; padding:0; background:#F6F6F9; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
        <tr>
            <td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                    <tr>
                        <td style="background:#6343cc; padding:24px 28px;">
                            <span style="color:#ffffff; font-size:20px; font-weight:600;">GeoTrack</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px;">
                            <p style="font-size:15px; color:#181A20; margin:0 0 16px;">Hi {{ $recipientName }},</p>
                            <p style="font-size:15px; color:#5A5D6B; margin:0 0 20px; line-height:22px;">
                                Your class <strong>{{ $courseCode }} — {{ $courseTitle }}</strong> is starting
                                @if($minutesUntilStart > 0) in about {{ $minutesUntilStart }} minute{{ $minutesUntilStart === 1 ? '' : 's' }}@else now @endif.
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EDFC; border-radius:12px; margin-bottom:20px;">
                                <tr>
                                    <td style="padding:16px 18px;">
                                        <p style="margin:0 0 6px; font-size:13px; color:#8F94A4;">Starts at</p>
                                        <p style="margin:0 0 14px; font-size:16px; color:#181A20; font-weight:600;">{{ $startTime }}</p>
                                        <p style="margin:0 0 6px; font-size:13px; color:#8F94A4;">Venue</p>
                                        <p style="margin:0; font-size:16px; color:#181A20; font-weight:600;">{{ $venue ?: 'Not set' }}</p>
                                    </td>
                                </tr>
                            </table>
                            <p style="font-size:13px; color:#8F94A4; margin:0; line-height:20px;">
                                Open the GeoTrack app to check in once you're at the venue.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px 28px; border-top:1px solid #F1F2F6;">
                            <p style="font-size:11px; color:#B8BBC6; margin:0;">
                                You're receiving this because email notifications are on. You can turn them off in Profile → Notifications.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
