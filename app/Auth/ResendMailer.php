<?php
declare(strict_types=1);

namespace DokanFlow\Auth;

use RuntimeException;

final class ResendMailer
{
    public function __construct(
        private readonly string $apiKey,
        private readonly string $fromAddress,
    ) {
    }

    public function send(string $recipient, string $subject, string $html, string $text): void
    {
        if ($this->apiKey === '') {
            throw new EmailDeliveryException('Email delivery is not configured. Set RESEND_API_KEY in .env.');
        }
        if (filter_var($this->fromAddress, FILTER_VALIDATE_EMAIL) === false) {
            throw new EmailDeliveryException('Set MAIL_FROM to an email address on a verified Resend domain.');
        }
        if (!function_exists('curl_init')) {
            throw new EmailDeliveryException('Email delivery requires the PHP cURL extension to be enabled.');
        }

        $payload = json_encode([
            'from' => 'DokanFlow <' . $this->fromAddress . '>',
            'to' => [$recipient],
            'subject' => $subject,
            'html' => $html,
            'text' => $text,
        ], JSON_THROW_ON_ERROR);

        $handle = curl_init('https://api.resend.com/emails');
        if ($handle === false) {
            throw new RuntimeException('Unable to initialize the email transport.');
        }

        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->apiKey,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
        ]);
        $response = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $transportError = $response === false ? curl_error($handle) : '';
        curl_close($handle);

        if ($response === false || $status < 200 || $status >= 300) {
            error_log(sprintf(
                'DokanFlow email delivery failed (HTTP %d). %s',
                $status,
                $transportError === '' ? '' : 'Transport error: ' . substr($transportError, 0, 200),
            ));
            throw new EmailDeliveryException('We could not send the email. Check the Resend API key and verified sender, then try again.');
        }
    }
}
