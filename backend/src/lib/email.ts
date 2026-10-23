import { Resend } from 'resend';
import { env } from '../env.js';

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const client = getResendClient();
  if (!client) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email send');
    return false;
  }

  try {
    await client.emails.send({
      from: 'FastRouteCO <noreply@fastrouteco.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (error) {
    console.error('[email] Failed to send email:', error);
    return false;
  }
}

export async function sendCompanyConfirmationEmail(
  companyEmail: string,
  companyName: string
): Promise<boolean> {
  return sendEmail({
    to: companyEmail,
    subject: 'Bienvenido a FastRouteCO — Confirmación de registro',
    html: `
      <h1>Bienvenido a FastRouteCO</h1>
      <p>Hola <strong>${companyName}</strong>,</p>
      <p>Tu empresa ha sido registrada exitosamente en FastRouteCO.</p>
      <p>Tu periodo de prueba gratuito de 7 días ha comenzado.</p>
      <p>El administrador de la empresa recibirá una invitación por separado para configurar su cuenta.</p>
      <hr>
      <p><small>Equipo FastRouteCO</small></p>
    `,
    text: `Bienvenido a FastRouteCO\n\nHola ${companyName},\n\nTu empresa ha sido registrada exitosamente en FastRouteCO.\nTu periodo de prueba gratuito de 7 días ha comenzado.\nEl administrador de la empresa recibirá una invitación por separado para configurar su cuenta.\n\nEquipo FastRouteCO`,
  });
}

export async function sendInvitationEmail(
  userEmail: string,
  userName: string,
  invitationUrl: string,
  companyName: string
): Promise<boolean> {
  return sendEmail({
    to: userEmail,
    subject: `Invitación a FastRouteCO — ${companyName}`,
    html: `
      <h1>Invitación a FastRouteCO</h1>
      <p>Hola <strong>${userName}</strong>,</p>
      <p>Has sido invitado a unirte a <strong>${companyName}</strong> en FastRouteCO como Administrador de la empresa.</p>
      <p>Define tu contraseña en el siguiente enlace (válido por 72 horas):</p>
      <p><a href="${invitationUrl}">${invitationUrl}</a></p>
      <hr>
      <p><small>Equipo FastRouteCO</small></p>
    `,
    text: `Invitación a FastRouteCO\n\nHola ${userName},\n\nHas sido invitado a unirte a ${companyName} en FastRouteCO como Administrador de la empresa.\nDefine tu contraseña en el siguiente enlace (válido por 72 horas):\n${invitationUrl}\n\nEquipo FastRouteCO`,
  });
}