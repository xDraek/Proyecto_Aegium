// Correo saliente con Brevo, por su API web (el plan gratuito de Render no deja usar SMTP).
//
//   BREVO_API_KEY   clave de la API de Brevo (Ajustes → SMTP y API → Claves API)
//   MAIL_FROM       remitente verificado en Brevo (por ejemplo, tu Gmail)
//   MAIL_FROM_NAME  nombre que ve el jugador (por defecto, «Aegium»)
//
// Sin clave, los correos no se mandan: se escriben en la consola del servidor, para probar en local.

import { escapeHtml } from '../src/ui/format.js';

export const mailEnabled = () => !!process.env.BREVO_API_KEY;

/**
 * Dirección pública del juego para los enlaces de los correos. Nunca se toma de la petición
 * (alguien podría falsear la cabecera Host y colar un enlace a otra web para robar cuentas);
 * en local, sin correo de verdad, vale la del navegador.
 */
export function publicUrl(req) {
  const fixed = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  if (fixed) return fixed.replace(/\/+$/, '');
  if (!mailEnabled()) return `http://${req.headers.host ?? 'localhost'}`;
  throw new Error('Falta PUBLIC_URL: la dirección pública del juego para los enlaces de los correos.');
}

/**
 * Un correo con el estilo del juego: el logo arriba, una tarjeta con el mensaje y un botón dorado.
 * Va maquetado con tablas y estilos en línea, que es lo único que respetan Gmail, Outlook y los
 * móviles; el logo es una imagen (los programas de correo no cargan las fuentes de la web).
 */
function template({ title, preheader, lines, button, link, foot }) {
  const base = new URL(link).origin;
  const site = base.replace(/^https?:\/\//, '');
  const url = escapeHtml(link);
  const serif = "Georgia,'Times New Roman',serif";
  const p = (t) => `<p style="margin:0 0 16px;font-family:${serif};font-size:16px;line-height:1.6;color:#efe4cc">${t}</p>`;
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#15110d">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#15110d">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#15110d">
<tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
    <tr><td align="center" style="padding:0 0 22px">
      <a href="${escapeHtml(base)}" style="text-decoration:none"><img src="${escapeHtml(base)}/ui/correo-logo.png" width="260" alt="AEGIUM" style="display:block;width:260px;max-width:70%;height:auto;border:0;margin:0 auto;font-family:${serif};font-size:32px;font-weight:bold;letter-spacing:6px;color:#f2c94c"></a>
    </td></tr>
    <tr><td style="background:#1f1913;border:1px solid #4a3b22;border-top:3px solid #d4a23a;border-radius:10px;padding:34px 34px 28px">
      <h1 style="margin:0 0 20px;font-family:${serif};font-size:24px;font-weight:bold;line-height:1.3;color:#f2c94c">${escapeHtml(title)}</h1>
      ${lines.map(p).join('\n      ')}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 26px"><tr>
        <td align="center" bgcolor="#d9a73a" style="border-radius:8px;background:#d9a73a;background-image:linear-gradient(180deg,#f2c94c,#c48b22)">
          <a href="${url}" style="display:inline-block;padding:14px 30px;font-family:${serif};font-size:17px;font-weight:bold;letter-spacing:.5px;color:#2a1c08;text-decoration:none;border-radius:8px;border:1px solid #8a5d14">${escapeHtml(button)}</a>
        </td>
      </tr></table>
      <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#a99a7d">Si el botón no funciona, copia esta dirección en el navegador:<br><a href="${url}" style="color:#d9b45a;word-break:break-all">${url}</a></p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #3d311d;padding-top:18px;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#a99a7d">${foot}</td></tr></table>
    </td></tr>
    <tr><td align="center" style="padding:24px 12px 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.7;color:#7d6f57">
      <span style="font-family:${serif};font-size:13px;letter-spacing:3px;color:#b58d3c">AEGIUM</span> · Juego de estrategia en el navegador<br>
      Este correo se envía automáticamente: no hace falta que lo respondas.<br>
      <a href="${escapeHtml(base)}" style="color:#b58d3c;text-decoration:none">${escapeHtml(site)}</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
  const plain = (t) => t.replace(/<[^>]+>/g, '');
  const text = [
    'AEGIUM',
    '══════',
    '',
    title,
    '',
    ...lines.map(plain).flatMap((l) => [l, '']),
    `${button}:`,
    link,
    '',
    '──────',
    plain(foot),
    '',
    `Aegium · Juego de estrategia en el navegador · ${site}`,
    'Este correo se envía automáticamente: no hace falta que lo respondas.',
  ].join('\n');
  return { html, text };
}

export const MAILS = {
  registro: ({ username, link }) => ({
    subject: 'Confirma tu cuenta de Aegium',
    ...template({
      title: `¡Bienvenido, ${username}!`,
      preheader: 'Confirma tu correo y funda tu primera ciudad en el Egeo.',
      lines: ['Gracias por unirte a Aegium. Solo falta un paso para fundar tu ciudad: confirma que este correo es tuyo.', 'El enlace vale durante <b>24 horas</b>.'],
      button: 'Confirmar mi cuenta',
      link,
      foot: 'Si no has creado ninguna cuenta en Aegium, no hagas nada: sin confirmar, se borra sola.',
    }),
  }),
  correo: ({ username, link }) => ({
    subject: 'Confirma tu correo en Aegium',
    ...template({
      title: `Hola, ${username}`,
      preheader: 'Confirma el correo nuevo de tu cuenta de Aegium.',
      lines: ['Has pedido usar este correo en tu cuenta de Aegium. Confírmalo con el botón.', 'El enlace vale durante <b>24 horas</b>.'],
      button: 'Confirmar el correo',
      link,
      foot: 'Si no has sido tú, no hagas nada: el correo de tu cuenta no cambiará.',
    }),
  }),
  clave: ({ username, link }) => ({
    subject: 'Cambia tu contraseña de Aegium',
    ...template({
      title: `Hola, ${username}`,
      preheader: 'Pon una contraseña nueva para volver a tu ciudad.',
      lines: ['Alguien (seguramente tú) ha pedido una contraseña nueva para tu cuenta.', 'El enlace vale durante <b>1 hora</b> y solo se puede usar una vez.'],
      button: 'Poner una contraseña nueva',
      link,
      foot: 'Si no lo has pedido tú, no hagas nada: tu contraseña sigue igual.',
    }),
  }),
};

/** Manda un correo (o, sin Brevo, lo escribe en la consola). */
export async function sendMail(to, { subject, html, text }) {
  if (!mailEnabled()) {
    console.log(`\n✉️  [correo sin mandar: falta BREVO_API_KEY] Para: ${to}\n   ${subject}\n${text.replace(/^/gm, '   ')}\n`);
    return;
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: process.env.MAIL_FROM, name: process.env.MAIL_FROM_NAME || 'Aegium' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) {
    console.error('Brevo no ha aceptado el correo', res.status, await res.text().catch(() => ''));
    throw new Error('mail');
  }
}
