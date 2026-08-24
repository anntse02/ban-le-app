import nodemailer from "nodemailer";

interface SendEmailWithExcelOptions {
  to: string;
  subject: string;
  htmlContent: string;
  excelBuffer: Buffer;
  fileName: string;
}

export async function sendEmailWithAttachment(options: SendEmailWithExcelOptions) {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const senderName = process.env.SENDER_NAME || "Quản Lý Bán Lẻ";

  if (!user || !pass) {
    throw new Error(
      "Chưa cấu hình SMTP_USER hoặc SMTP_PASSWORD trong file .env.local! Vui lòng cấu hình tài khoản gửi mail."
    );
  }

  // Khởi tạo Transporter
  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465, // true cho port 465 (SSL), false cho port 587 (TLS)
    auth: {
      user: user,
      pass: pass,
    },
  });

  // Gửi mail
  const info = await transporter.sendMail({
    from: `"${senderName}" <${user}>`,
    to: options.to,
    subject: options.subject,
    html: options.htmlContent,
    attachments: [
      {
        filename: options.fileName,
        content: options.excelBuffer,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });

  return info;
}