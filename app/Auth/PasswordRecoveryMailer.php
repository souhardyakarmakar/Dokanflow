<?php
declare(strict_types=1);

namespace DokanFlow\Auth;

use RuntimeException;
use Throwable;

final class PasswordRecoveryMailer
{
    /**
     * @param array{host:string,port:int,encryption:string,username:string,password:string,from:string,from_name:string} $config
     */
    public function __construct(private readonly array $config)
    {
    }

    public function sendOtp(string $email, string $name, string $otp): void
    {
        if (
            $this->config['host'] === ''
            || $this->config['username'] === ''
            || $this->config['password'] === ''
            || filter_var($this->config['from'], FILTER_VALIDATE_EMAIL) === false
            || $this->config['port'] !== 587
            || $this->config['encryption'] !== 'tls'
        ) {
            throw new RuntimeException('Password recovery email is not configured.');
        }

        if (!class_exists(\PHPMailer\PHPMailer\PHPMailer::class)) {
            throw new RuntimeException('PHPMailer is not installed.');
        }

        $mailer = new \PHPMailer\PHPMailer\PHPMailer(true);
        try {
            $mailer->isSMTP();
            $mailer->Host = $this->config['host'];
            $mailer->SMTPAuth = true;
            $mailer->Username = $this->config['username'];
            $mailer->Password = $this->config['password'];
            $mailer->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            $mailer->Port = 587;
            $mailer->Timeout = 15;
            $mailer->SMTPDebug = 0;
            $mailer->CharSet = 'UTF-8';
            $mailer->setFrom($this->config['from'], $this->config['from_name']);
            $mailer->addAddress($email, $name);
            $mailer->isHTML(true);
            $mailer->Subject = 'Your DokanFlow password reset code';
            $mailer->Body = $this->htmlBody($name, $otp);
            $mailer->AltBody = sprintf(
                "Hello %s,\n\nYour DokanFlow password reset code is %s.\nIt expires in five minutes. Do not share this code with anyone.\n\nIf you did not request this, you can ignore this message.\n",
                $name,
                $otp,
            );
            $mailer->send();
        } catch (Throwable $error) {
            throw new RuntimeException('Password recovery email could not be sent.');
        }
    }

    private function htmlBody(string $name, string $otp): string
    {
        $escapedName = htmlspecialchars($name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        return <<<HTML
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#EAE8DF;font-family:Arial,Helvetica,sans-serif;color:#282C28">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#FCFAF3;border-radius:16px">
    <tr><td style="padding:32px 32px 8px">
      <div style="font-size:20px;font-weight:700;letter-spacing:-.3px;color:#282C28">DokanFlow</div>
      <div style="height:1px;background:#DAD7CB;margin:22px 0"></div>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3">Password Reset Request</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Hello {$escapedName}, use this one-time code to reset your password.</p>
      <div style="padding:18px 12px;border-radius:12px;background:#F0EDDF;text-align:center;color:#282C28;font-size:34px;font-weight:700;letter-spacing:10px">{$otp}</div>
      <p style="margin:18px 0;font-size:14px;line-height:1.6;color:#55564D">This code expires in five minutes. For your security, never share it with anyone, including DokanFlow support.</p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#73736A">If you did not request a password reset, you can safely ignore this email. Your password will not change.</p>
      <div style="height:1px;background:#DAD7CB"></div>
      <p style="margin:18px 0 0;font-size:12px;color:#73736A">DokanFlow · Your business, under control.</p>
    </td></tr>
  </table>
</body>
</html>
HTML;
    }
}
