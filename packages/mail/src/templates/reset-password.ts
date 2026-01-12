export function getResetPasswordEmailTemplate(
  appName: string,
  resetUrl: string,
  userName?: string
): { subject: string; html: string; text: string } {
  const greeting = userName ? `Hola ${userName},` : "Hola,";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablece tu contraseña</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center;">
    <h1 style="color: #dc2626; margin-bottom: 20px;">Restablece tu contraseña</h1>
    <p style="font-size: 16px; margin-bottom: 30px;">
      ${greeting}
    </p>
    <p style="font-size: 16px; margin-bottom: 30px;">
      Recibimos una solicitud para restablecer la contraseña de tu cuenta en ${appName}. Haz clic en el botón de abajo para crear una nueva contraseña.
    </p>
    <a href="${resetUrl}" style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-bottom: 30px;">
      Restablecer contraseña
    </a>
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="font-size: 12px; color: #9ca3af; word-break: break-all;">
      ${resetUrl}
    </p>
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Este enlace expirará en 1 hora.
    </p>
    <p style="font-size: 14px; color: #dc2626; margin-top: 30px; font-weight: 600;">
      Si no solicitaste restablecer tu contraseña, ignora este email de forma segura.
    </p>
  </div>
  <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 20px;">
    Por seguridad, nunca compartas este enlace con nadie.
  </p>
</body>
</html>
  `.trim();

  const text = `
${greeting}

Recibimos una solicitud para restablecer la contraseña de tu cuenta en ${appName}. Visita el siguiente enlace para crear una nueva contraseña:

${resetUrl}

Este enlace expirará en 1 hora.

Si no solicitaste restablecer tu contraseña, ignora este email de forma segura.

Por seguridad, nunca compartas este enlace con nadie.
  `.trim();

  return {
    subject: `Restablece tu contraseña - ${appName}`,
    html,
    text,
  };
}
