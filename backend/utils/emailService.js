/**
 * Servicio de email que soporta modo desarrollo y producción
 * En desarrollo: muestra códigos en consola
 * En producción: envía emails reales
 */

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.hasEmailConfig = process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_PASS !== 'CAMBIAR_POR_APP_PASSWORD_DE_GMAIL';
    
    if (!this.isDevelopment && this.hasEmailConfig) {
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    }
    
    console.log(`📧 Email Service inicializado:`);
    console.log(`   Modo: ${this.isDevelopment ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
    console.log(`   Email config: ${this.hasEmailConfig ? 'SÍ' : 'NO'}`);
  }

  /**
   * Envía un email o muestra en consola según el modo
   */
  async sendEmail({ to, subject, html, code = null }) {
    // Modo desarrollo: mostrar en consola
    if (this.isDevelopment || !this.hasEmailConfig) {
      console.log('\n' + '='.repeat(60));
      console.log('📧 EMAIL SIMULADO (MODO DESARROLLO)');
      console.log('='.repeat(60));
      console.log(`Para: ${to}`);
      console.log(`Asunto: ${subject}`);
      if (code) {
        console.log(`🔑 CÓDIGO DE VERIFICACIÓN: ${code}`);
      }
      console.log('Contenido HTML:');
      console.log(html);
      console.log('='.repeat(60) + '\n');
      
      return { success: true, mode: 'development', code };
    }

    // Modo producción: enviar email real
    try {
      const mailOptions = {
        from: `"Rapigoo 🚀" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email enviado a ${to}`);
      return { success: true, mode: 'production', messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error enviando email:', error.message);
      throw error;
    }
  }

  /**
   * Envía código de verificación para registro
   */
  async sendVerificationCode(email, code, name = 'Usuario') {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4CAF50; margin: 0;">Rapigoo 🚀</h1>
        </div>
        
        <h2 style="color: #333;">¡Hola ${name}! 👋</h2>
        
        <p style="font-size: 16px; color: #666; line-height: 1.6;">
          Gracias por registrarte en Rapigoo. Para completar tu registro, usa el siguiente código de verificación:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <div style="background: #f8f9fa; border: 2px dashed #4CAF50; border-radius: 8px; padding: 20px; display: inline-block;">
            <h1 style="color: #4CAF50; margin: 0; font-size: 32px; letter-spacing: 5px;">${code}</h1>
          </div>
        </div>
        
        <p style="font-size: 14px; color: #999; text-align: center;">
          Este código expira en 10 minutos por seguridad.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; text-align: center;">
          Si no solicitaste este código, puedes ignorar este email.
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: '🔐 Código de verificación - Rapigoo',
      html,
      code
    });
  }

  /**
   * Envía código para recuperación de contraseña
   */
  async sendPasswordResetCode(email, code) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #FF5722; margin: 0;">Rapigoo 🚀</h1>
        </div>
        
        <h2 style="color: #333;">Recuperación de contraseña 🔒</h2>
        
        <p style="font-size: 16px; color: #666; line-height: 1.6;">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta. 
          Usa el siguiente código para continuar:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <div style="background: #fff3e0; border: 2px dashed #FF5722; border-radius: 8px; padding: 20px; display: inline-block;">
            <h1 style="color: #FF5722; margin: 0; font-size: 32px; letter-spacing: 5px;">${code}</h1>
          </div>
        </div>
        
        <p style="font-size: 14px; color: #999; text-align: center;">
          Este código expira en 10 minutos por seguridad.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; text-align: center;">
          Si no solicitaste este cambio, tu cuenta sigue siendo segura. Puedes ignorar este email.
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: '🔐 Recuperación de contraseña - Rapigoo',
      html,
      code
    });
  }

  /**
   * Verifica si el servicio está configurado correctamente
   */
  isConfigured() {
    return this.isDevelopment || this.hasEmailConfig;
  }

  /**
   * Obtiene el estado del servicio
   */
  getStatus() {
    return {
      mode: this.isDevelopment ? 'development' : 'production',
      configured: this.isConfigured(),
      hasEmailConfig: this.hasEmailConfig
    };
  }
}

// Crear instancia singleton
const emailService = new EmailService();

module.exports = emailService;