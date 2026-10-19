<?php

namespace App\Services;

use Exception;
use Illuminate\Support\Facades\Log;

/**
 * Native ZKTeco Protocol Client for Solution X100-C and ZKTeco standalone devices.
 * Uses UDP socket over Port 4370 without external dependencies.
 */
class ZKTecoService
{
    private const USHRT_MAX = 65535;

    // Commands
    private const CMD_CONNECT = 1000;
    private const CMD_DISCONNECT = 1001;
    private const CMD_ENABLEDEVICE = 1008;
    private const CMD_DISABLEDEVICE = 1007;
    private const CMD_DEVICE_INFO = 11;
    private const CMD_VERSION = 1100;
    private const CMD_ATTLOG_RRQ = 13;
    private const CMD_CLEAR_ATTLOG = 14;
    private const CMD_FREE_DATA = 1060;

    // Replies
    private const CMD_ACK_OK = 2000;
    private const CMD_ACK_ERROR = 2001;
    private const CMD_ACK_DATA = 2002;
    private const CMD_PREPARE_DATA = 1500;
    private const CMD_DATA = 1501;

    /** @var resource|null */
    private $socket = null;
    private int $sessionId = 0;
    private int $replyId = 0;
    private string $ip = '';
    private int $port = 4370;

    /**
     * Test connection to device. Returns device info on success or throws Exception.
     */
    public function testConnection(string $ip, int $port = 4370, int $timeout = 4): array
    {
        $this->connect($ip, $port, $timeout);
        try {
            $version = $this->getVersion();
            $serialNumber = $this->getSerialNumber();
            $counts = $this->getDeviceCounts();

            return [
                'status' => 'online',
                'ip' => $ip,
                'port' => $port,
                'version' => $version ?: 'ZKTeco Standalone',
                'serial_number' => $serialNumber ?: 'Unknown',
                'user_count' => $counts['users'] ?? 0,
                'log_count' => $counts['logs'] ?? 0,
            ];
        } finally {
            $this->disconnect();
        }
    }

    /**
     * Retrieve attendance records from device.
     *
     * @return array<int, array{pin: string, timestamp: string, state: int, type: int}>
     */
    public function getAttendanceLogs(string $ip, int $port = 4370, int $timeout = 5): array
    {
        $this->connect($ip, $port, $timeout);
        try {
            return $this->fetchAttendanceLogs();
        } finally {
            $this->disconnect();
        }
    }

    public function connect(string $ip, int $port = 4370, int $timeout = 4): bool
    {
        $this->ip = $ip;
        $this->port = $port;
        $this->replyId = self::USHRT_MAX - 1;
        $this->sessionId = 0;

        $socket = @fsockopen("udp://$ip", $port, $errno, $errstr, $timeout);
        if (!$socket) {
            throw new Exception("Gagal membuka koneksi socket ke {$ip}:{$port} ({$errstr})");
        }

        stream_set_timeout($socket, $timeout);
        $this->socket = $socket;

        $packet = $this->createHeader(self::CMD_CONNECT, 0, 0);
        $reply = $this->sendAndReceive($packet);

        if (!$reply || count($reply) < 8) {
            $this->disconnect();
            throw new Exception("Mesin di {$ip}:{$port} tidak merespons (Timeout)");
        }

        $code = unpack('vcode', substr($reply, 0, 2))['code'];
        $this->sessionId = unpack('vsession', substr($reply, 4, 2))['session'];
        $this->replyId = unpack('vreply', substr($reply, 6, 2))['reply'];

        if ($code !== self::CMD_ACK_OK) {
            $this->disconnect();
            throw new Exception("Handshake koneksi ditolak mesin dengan kode: {$code}");
        }

        return true;
    }

    public function disconnect(): void
    {
        if ($this->socket) {
            try {
                $packet = $this->createHeader(self::CMD_DISCONNECT, $this->sessionId, $this->replyId);
                @fwrite($this->socket, $packet);
            } catch (Exception $e) {
                // Ignore disconnect packet failure
            }
            @fclose($this->socket);
            $this->socket = null;
        }
    }

    private function getVersion(): string
    {
        $packet = $this->createHeader(self::CMD_VERSION, $this->sessionId, $this->replyId);
        $reply = $this->sendAndReceive($packet);
        if ($reply && strlen($reply) > 8) {
            return trim(substr($reply, 8));
        }
        return '';
    }

    private function getSerialNumber(): string
    {
        $payload = '~SerialNumber' . "\0";
        $packet = $this->createHeader(self::CMD_DEVICE_INFO, $this->sessionId, $this->replyId, $payload);
        $reply = $this->sendAndReceive($packet);
        if ($reply && strlen($reply) > 8) {
            $data = substr($reply, 8);
            if (str_contains($data, '=')) {
                $parts = explode('=', $data, 2);
                return trim($parts[1]);
            }
            return trim($data);
        }
        return '';
    }

    private function getDeviceCounts(): array
    {
        $packet = $this->createHeader(self::CMD_FREE_DATA, $this->sessionId, $this->replyId);
        $reply = $this->sendAndReceive($packet);
        $counts = ['users' => 0, 'logs' => 0];

        if ($reply && strlen($reply) >= 28) {
            $data = substr($reply, 8);
            if (strlen($data) >= 20) {
                $parsed = unpack('Vuser_count/Vfp_count/Vlog_count', substr($data, 16));
                $counts['users'] = $parsed['user_count'] ?? 0;
                $counts['logs'] = $parsed['log_count'] ?? 0;
            }
        }

        return $counts;
    }

    private function fetchAttendanceLogs(): array
    {
        $packet = $this->createHeader(self::CMD_ATTLOG_RRQ, $this->sessionId, $this->replyId);
        $reply = $this->sendAndReceive($packet);

        if (!$reply || strlen($reply) < 8) {
            return [];
        }

        $code = unpack('vcode', substr($reply, 0, 2))['code'];
        if ($code === self::CMD_ACK_OK) {
            // No data
            return [];
        }

        $buffer = '';
        if ($code === self::CMD_PREPARE_DATA) {
            $bytesExpected = unpack('Vsize', substr($reply, 8, 4))['size'] ?? 0;
            $receivedBytes = 0;

            while ($receivedBytes < $bytesExpected) {
                $chunk = @fread($this->socket, 1032);
                if (!$chunk) {
                    break;
                }
                if (strlen($chunk) > 8) {
                    $payload = substr($chunk, 8);
                    $buffer .= $payload;
                    $receivedBytes += strlen($payload);
                }
            }
        } elseif ($code === self::CMD_DATA) {
            $buffer = substr($reply, 8);
        }

        return $this->parseAttendanceBuffer($buffer);
    }

    /**
     * Parse binary attendance records.
     * ZK attendance records are commonly 40 bytes (TFT) or 8 bytes/24 bytes/16 bytes.
     */
    private function parseAttendanceBuffer(string $buffer): array
    {
        $records = [];
        $length = strlen($buffer);
        if ($length < 4) {
            return [];
        }

        // Standard 40-byte record format for TFT screen devices (like X100-C):
        // 2 bytes user internal ID, 24 bytes string user PIN, 1 byte verified, 4 bytes timestamp, 1 byte status, etc.
        $recordSize = 40;
        if ($length % $recordSize === 0) {
            $total = (int) ($length / $recordSize);
            for ($i = 0; $i < $total; $i++) {
                $record = substr($buffer, $i * $recordSize, $recordSize);
                $pin = trim(substr($record, 2, 24));
                $pin = preg_replace('/[^\d]/', '', $pin);
                $verified = ord($record[26] ?? "\0");
                $timeSec = unpack('Vtime', substr($record, 27, 4))['time'] ?? 0;
                $status = ord($record[31] ?? "\0");

                $dt = $this->decodeTime($timeSec);
                if (!empty($pin) && $dt) {
                    $records[] = [
                        'pin' => $pin,
                        'timestamp' => $dt,
                        'state' => $status,
                        'verify_type' => $verified,
                    ];
                }
            }
            return $records;
        }

        // Fallback older 8-byte or 14-byte format
        if ($length >= 8) {
            $recordSize = 8;
            $total = (int) ($length / $recordSize);
            for ($i = 0; $i < $total; $i++) {
                $record = substr($buffer, $i * $recordSize, $recordSize);
                $userId = unpack('vuid', substr($record, 0, 2))['uid'] ?? 0;
                $timeSec = unpack('Vtime', substr($record, 2, 4))['time'] ?? 0;
                $state = ord($record[6] ?? "\0");

                $dt = $this->decodeTime($timeSec);
                if ($userId > 0 && $dt) {
                    $records[] = [
                        'pin' => (string) $userId,
                        'timestamp' => $dt,
                        'state' => $state,
                        'verify_type' => 1,
                    ];
                }
            }
        }

        return $records;
    }

    private function decodeTime(int $time): ?string
    {
        if ($time <= 0) {
            return null;
        }

        $second = $time % 60;
        $time = (int) ($time / 60);
        $minute = $time % 60;
        $time = (int) ($time / 60);
        $hour = $time % 24;
        $time = (int) ($time / 24);
        $day = $time % 31 + 1;
        $time = (int) ($time / 31);
        $month = $time % 12 + 1;
        $time = (int) ($time / 12);
        $year = $time + 2000;

        return sprintf('%04d-%02d-%02d %02d:%02d:%02d', $year, $month, $day, $hour, $minute, $second);
    }

    private function createHeader(int $command, int $sessionId, int $replyId, string $payload = ''): string
    {
        $buffer = pack('vvvv', $command, 0, $sessionId, $replyId) . $payload;
        $checksum = $this->calculateChecksum($buffer);
        return pack('vvvv', $command, $checksum, $sessionId, $replyId) . $payload;
    }

    private function calculateChecksum(string $p): int
    {
        $length = strlen($p);
        $checksum = 0;
        $i = 0;

        while ($length > 1) {
            $checksum += unpack('v', substr($p, $i, 2))[1];
            $i += 2;
            $length -= 2;
        }

        if ($length) {
            $checksum += ord($p[$i]);
        }

        while ($checksum >> 16) {
            $checksum = ($checksum & 0xFFFF) + ($checksum >> 16);
        }

        return ~$checksum & 0xFFFF;
    }

    private function sendAndReceive(string $packet): ?string
    {
        if (!$this->socket) {
            return null;
        }

        @fwrite($this->socket, $packet);
        $reply = @fread($this->socket, 1024);

        if (!$reply) {
            return null;
        }

        return $reply;
    }
}
