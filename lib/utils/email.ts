/**
 * Email utility for sending student credentials
 * Using Nodemailer with Gmail (FREE)
 * 
 * Setup Instructions:
 * 1. Create a Gmail account for your app
 * 2. Enable 2-Factor Authentication
 * 3. Generate App Password: https://myaccount.google.com/apppasswords
 * 4. Add to .env.local:
 *    EMAIL_USER=your-email@gmail.com
 *    EMAIL_PASSWORD=your-app-password
 */

import nodemailer from 'nodemailer';

// Create transporter (reusable)
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

/**
 * Send student credentials via email
 */
export async function sendStudentCredentials(
  studentEmail: string,
  studentName: string,
  userId: string,
  password: string,
  teacherName: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('❌ Email not configured. Add EMAIL_USER and EMAIL_PASSWORD to .env.local');
      
      // Return success but log credentials (for development)
      console.log('\n📧 EMAIL NOT SENT (Not Configured)');
      console.log('Student Email:', studentEmail);
      console.log('User ID:', userId);
      console.log('Password:', password);
      console.log('\n');
      
      return {
        success: true,
        message: 'Student created but email not sent (email not configured). Check console for credentials.',
      };
    }

    const transporter = createTransporter();

    // Email HTML template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border: 1px solid #e5e7eb;
              border-top: none;
            }
            .credentials-box {
              background: white;
              border: 2px solid #667eea;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .credential-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .credential-row:last-child {
              border-bottom: none;
            }
            .label {
              font-weight: 600;
              color: #6b7280;
            }
            .value {
              font-family: 'Courier New', monospace;
              font-weight: bold;
              color: #1f2937;
              font-size: 16px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
            }
            .footer {
              background: #f9fafb;
              padding: 20px;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
              border-radius: 0 0 10px 10px;
              border: 1px solid #e5e7eb;
              border-top: none;
            }
            .warning {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎓 Welcome to Exam Portal</h1>
            <p>Your account has been created successfully!</p>
          </div>
          
          <div class="content">
            <p>Hello <strong>${studentName}</strong>,</p>
            
            <p>
              Your teacher <strong>${teacherName}</strong> has created an account for you 
              on the Exam Portal platform. You can now access the system and submit your answer sheets.
            </p>
            
            <div class="credentials-box">
              <h3 style="margin-top: 0; color: #667eea;">🔐 Your Login Credentials</h3>
              
              <div class="credential-row">
                <span class="label">User ID:</span>
                <span class="value">${userId}</span>
              </div>
              
              <div class="credential-row">
                <span class="label">Password:</span>
                <span class="value">${password}</span>
              </div>
              
              <div class="credential-row">
                <span class="label">Email:</span>
                <span class="value">${studentEmail}</span>
              </div>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> Please change your password after your first login 
              for security purposes. Keep your credentials safe and do not share them with anyone.
            </div>
            
            <center>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" class="button">
                Login to Portal
              </a>
            </center>
            
            <h3>📋 Next Steps:</h3>
            <ol>
              <li>Click the login button above or visit the portal</li>
              <li>Enter your User ID and Password</li>
              <li>Change your password from settings</li>
              <li>Complete your profile information</li>
              <li>Start submitting answer sheets</li>
            </ol>
            
            <p>
              If you have any questions or face any issues logging in, please contact your teacher 
              or the system administrator.
            </p>
          </div>
          
          <div class="footer">
            <p>
              This is an automated email. Please do not reply to this message.
            </p>
            <p>
              © ${new Date().getFullYear()} Exam Portal. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `;

    // Plain text version (fallback)
    const textContent = `
Welcome to Exam Portal!

Hello ${studentName},

Your teacher ${teacherName} has created an account for you on the Exam Portal platform.

Your Login Credentials:
- User ID: ${userId}
- Password: ${password}
- Email: ${studentEmail}

IMPORTANT: Please change your password after your first login for security purposes.

Login URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login

Next Steps:
1. Visit the login page
2. Enter your User ID and Password
3. Change your password from settings
4. Complete your profile information
5. Start submitting answer sheets

If you have any questions, please contact your teacher.

© ${new Date().getFullYear()} Exam Portal. All rights reserved.
    `;

    // Send email
    const info = await transporter.sendMail({
      from: `"Exam Portal" <${process.env.EMAIL_USER}>`,
      to: studentEmail,
      subject: '🎓 Your Exam Portal Login Credentials',
      text: textContent,
      html: htmlContent,
    });

    console.log('✅ Email sent successfully:', info.messageId);

    return {
      success: true,
      message: 'Student created and credentials sent via email successfully!',
    };
  } catch (error: any) {
    console.error('❌ Email sending failed:', error);

    // Log credentials for manual sharing
    console.log('\n📧 EMAIL FAILED - Manual Credentials:');
    console.log('Student Email:', studentEmail);
    console.log('User ID:', userId);
    console.log('Password:', password);
    console.log('\n');

    return {
      success: false,
      message: `Student created but email failed: ${error.message}. Credentials logged to console.`,
    };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return {
        success: false,
        message: 'Email service not configured',
      };
    }

    const transporter = createTransporter();
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>Hello ${name},</p>
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <a href="${resetUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Reset Password
            </a>
            <p>Or copy this link: ${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Exam Portal" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Password Reset Request',
      html: htmlContent,
    });

    return {
      success: true,
      message: 'Password reset email sent successfully',
    };
  } catch (error: any) {
    console.error('Password reset email failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfiguration(): Promise<boolean> {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('❌ Email credentials not configured');
      return false;
    }

    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email configuration is valid');
    return true;
  } catch (error) {
    console.error('❌ Email configuration test failed:', error);
    return false;
  }
}
