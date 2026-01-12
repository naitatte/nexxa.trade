export function getVerificationEmailTemplate(
  appName: string,
  verificationUrl: string,
  userName?: string
): { subject: string; html: string; text: string } {
  const greeting = userName ? `Hola ${userName},` : "Hola,";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifica tu email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center;">
    <h1 style="color: #2563eb; margin-bottom: 20px;">Verifica tu email</h1>
    <p style="font-size: 16px; margin-bottom: 30px;">
      ${greeting}
    </p>
    <p style="font-size: 16px; margin-bottom: 30px;">
      Gracias por registrarte en ${appName}. Por favor, haz clic en el botón de abajo para verificar tu dirección de correo electrónico.
    </p>
    <a href="${verificationUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-bottom: 30px;">
      Verificar email
    </a>
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="font-size: 12px; color: #9ca3af; word-break: break-all;">
      ${verificationUrl}
    </p>
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Este enlace expirará en 1 hora.
    </p>
  </div>
  <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 20px;">
    Si no creaste una cuenta en ${appName}, puedes ignorar este email de forma segura.
  </p>
</body>
</html>
  `.trim();

  const text = `
${greeting}

Gracias por registrarte en ${appName}. Por favor, visita el siguiente enlace para verificar tu dirección de correo electrónico:

${verificationUrl}

Este enlace expirará en 1 hora.

Si no creaste una cuenta en ${appName}, puedes ignorar este email de forma segura.
  `.trim();

  return {
    subject: `Verifica tu email - ${appName}`,
    html,
    text,
  };
}
