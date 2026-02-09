export function getInactiveSponsorReferralTemplate(
  appName: string,
  sponsorCode: string,
  referredLabel: string,
  userName?: string
): { subject: string; html: string; text: string } {
  const greeting = userName ? `Hello ${userName},` : "Hello,";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Referral Registered - Inactive Account</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 30px;">
    <h1 style="color: #f59e0b; margin-bottom: 20px;">New Referral Registered</h1>
    <p style="font-size: 16px; margin-bottom: 30px;">
      ${greeting}
    </p>
    <p style="font-size: 16px; margin-bottom: 30px;">
      Someone registered with your referral code (<strong>${sponsorCode}</strong>).
      Your account is <strong>inactive</strong> and you will lose the commission if you don't reactivate.
    </p>
    <div style="background-color: #ffffff; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="font-size: 14px; color: #6b7280; margin: 0 0 10px 0;"><strong>New referral:</strong></p>
      <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">${referredLabel}</p>
    </div>
    <p style="font-size: 16px; color: #dc2626; margin-top: 30px; font-weight: 600;">
      Reactivate now to avoid losing that commission.
    </p>
  </div>
  <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 20px;">
    This is an automated notification from ${appName}.
  </p>
</body>
</html>
  `.trim();

  const text = `
${greeting}

Someone registered with your referral code (${sponsorCode}).
Your account is inactive and you will lose the commission if you don't reactivate.

New referral: ${referredLabel}

Reactivate now to avoid losing that commission.

This is an automated notification from ${appName}.
  `.trim();

  return {
    subject: `New referral registered - inactive account - ${appName}`,
    html,
    text,
  };
}
