export function getChangeEmailOTPTemplate(
  appName: string,
  otpCode: string,
  newEmail: string,
  userName?: string
): { subject: string; html: string; text: string } {
  const greeting = userName ? `Hola ${userName},` : "Hola,";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cambio de email - Código de verificación</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center;">
    <h1 style="color: #2563eb; margin-bottom: 20px;">Cambio de email</h1>
    <p style="font-size: 16px; margin-bottom: 30px;">
      ${greeting}
    </p>
    <p style="font-size: 16px; margin-bottom: 30px;">
      Has solicitado cambiar tu dirección de correo electrónico a <strong>${newEmail}</strong> en ${appName}.
    </p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      Ingresa el siguiente código de verificación para completar el cambio:
    </p>
    <div style="background-color: #ffffff; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; margin: 30px 0; display: inline-block;">
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb; margin: 0; font-family: 'Courier New', monospace;">
        ${otpCode}
      </p>
    </div>
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Este código expirará en 10 minutos.
    </p>
    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      Si no solicitaste este cambio, puedes ignorar este email de forma segura.
    </p>
  </div>
  <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 20px;">
    Si no solicitaste este cambio en ${appName}, puedes ignorar este email de forma segura.
  </p>
</body>
</html>
  `.trim();

  const text = `
${greeting}

Has solicitado cambiar tu dirección de correo electrónico a ${newEmail} en ${appName}.

Ingresa el siguiente código de verificación para completar el cambio:

${otpCode}

Este código expirará en 10 minutos.

Si no solicitaste este cambio, puedes ignorar este email de forma segura.
  `.trim();

  return {
    subject: `Código de verificación - Cambio de email - ${appName}`,
    html,
    text,
  };
}
