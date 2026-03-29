/**
 * InSchool — Email HTML Templates
 * 
 * Template HTML professionali per email transazionali.
 * Usa solo HTML/CSS inline per compatibilità con tutti i client email.
 * 
 * Questi template possono essere copiati in Supabase Dashboard → Auth → Email Templates
 * oppure visualizzati nella pagina /admin/email-preview
 */

const BRAND = {
  name: "InSchool",
  domain: "inschool.azarlabs.com",
  year: 2026,
  bgColor: "#f8fafc",
  cardBg: "#ffffff",
  primaryColor: "#6366f1",
  primaryDark: "#4f46e5",
  textColor: "#1e293b",
  mutedColor: "#64748b",
  borderColor: "#e2e8f0",
  radius: "12px",
};

function wrapTemplate(body: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>InSchool</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.bgColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.bgColor};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: ${BRAND.cardBg}; border-radius: ${BRAND.radius}; border: 1px solid ${BRAND.borderColor}; overflow: hidden;">
          <!-- Logo Header -->
          <tr>
            <td style="padding: 32px 40px 24px; text-align: center; border-bottom: 1px solid ${BRAND.borderColor};">
              <div style="display: inline-block; font-size: 28px; font-weight: 800; color: ${BRAND.primaryColor}; letter-spacing: -0.5px;">
                📚 InSchool
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; border-top: 1px solid ${BRAND.borderColor}; background-color: ${BRAND.bgColor};">
              <p style="margin: 0; font-size: 12px; color: ${BRAND.mutedColor}; line-height: 1.5;">
                InSchool © ${BRAND.year} — <a href="https://${BRAND.domain}" style="color: ${BRAND.primaryColor}; text-decoration: none;">${BRAND.domain}</a>
              </p>
              <p style="margin: 8px 0 0; font-size: 11px; color: ${BRAND.mutedColor};">
                Hai ricevuto questa email perché sei registrato su InSchool.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding: 8px 0 16px;">
      <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 36px; background-color: ${BRAND.primaryColor}; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 10px; letter-spacing: 0.3px; mso-padding-alt: 0; text-align: center;">
        <!--[if mso]><i style="mso-font-width: -100%; mso-text-raise: 21pt;">&nbsp;</i><![endif]-->
        ${text}
        <!--[if mso]><i style="mso-font-width: -100%;">&nbsp;</i><![endif]-->
      </a>
    </td>
  </tr>
</table>`;
}

// ── WELCOME EMAIL ────────────────────────────────────────────────────────────
export const welcomeEmailTemplate = wrapTemplate(`
  <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: ${BRAND.textColor}; text-align: center;">
    Benvenuto su InSchool! 🎉
  </h1>
  <p style="margin: 0 0 12px; font-size: 15px; color: ${BRAND.textColor}; line-height: 1.6;">
    Ciao,
  </p>
  <p style="margin: 0 0 12px; font-size: 15px; color: ${BRAND.textColor}; line-height: 1.6;">
    Grazie per aver creato il tuo account su InSchool. Per iniziare, conferma il tuo indirizzo email cliccando il bottone qui sotto.
  </p>
  ${ctaButton("Conferma la tua email", "{{ .ConfirmationURL }}")}
  <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.mutedColor}; line-height: 1.5; text-align: center;">
    Se non hai creato un account su InSchool, puoi ignorare questa email.
  </p>
`);

// ── RESET PASSWORD EMAIL ─────────────────────────────────────────────────────
export const resetPasswordEmailTemplate = wrapTemplate(`
  <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: ${BRAND.textColor}; text-align: center;">
    Reimposta la tua password 🔐
  </h1>
  <p style="margin: 0 0 12px; font-size: 15px; color: ${BRAND.textColor}; line-height: 1.6;">
    Ciao,
  </p>
  <p style="margin: 0 0 12px; font-size: 15px; color: ${BRAND.textColor}; line-height: 1.6;">
    Abbiamo ricevuto una richiesta per reimpostare la password del tuo account InSchool. Clicca il bottone qui sotto per scegliere una nuova password.
  </p>
  ${ctaButton("Reimposta password", "{{ .ConfirmationURL }}")}
  <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.mutedColor}; line-height: 1.5; text-align: center;">
    Il link scade tra 24 ore. Se non hai richiesto il reset, puoi ignorare questa email.
  </p>
`);

// ── EMAIL CONFIRMATION (change email) ────────────────────────────────────────
export const confirmEmailChangeTemplate = wrapTemplate(`
  <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: ${BRAND.textColor}; text-align: center;">
    Conferma il tuo nuovo indirizzo email ✉️
  </h1>
  <p style="margin: 0 0 12px; font-size: 15px; color: ${BRAND.textColor}; line-height: 1.6;">
    Ciao,
  </p>
  <p style="margin: 0 0 12px; font-size: 15px; color: ${BRAND.textColor}; line-height: 1.6;">
    Hai richiesto di cambiare il tuo indirizzo email su InSchool. Clicca il bottone qui sotto per confermare il nuovo indirizzo.
  </p>
  ${ctaButton("Conferma email", "{{ .ConfirmationURL }}")}
  <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.mutedColor}; line-height: 1.5; text-align: center;">
    Se non hai richiesto questa modifica, contattaci immediatamente.
  </p>
`);

// Export all templates for preview page
export const emailTemplates = [
  { id: "welcome", label: "Email di benvenuto (Conferma registrazione)", html: welcomeEmailTemplate },
  { id: "reset", label: "Reset password", html: resetPasswordEmailTemplate },
  { id: "confirm-change", label: "Conferma cambio email", html: confirmEmailChangeTemplate },
];
