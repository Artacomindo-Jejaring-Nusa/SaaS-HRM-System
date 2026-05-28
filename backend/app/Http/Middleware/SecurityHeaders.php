<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * SecurityHeaders Middleware
 *
 * Adds critical HTTP security headers to all responses to mitigate
 * common web vulnerabilities identified by penetration testing:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME-type sniffing
 * - Information disclosure
 */
class SecurityHeaders
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Prevent MIME type sniffing (stops browser from guessing content type)
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // Prevent clickjacking attacks by disallowing embedding in iframes
        $response->headers->set('X-Frame-Options', 'DENY');

        // Enable XSS protection filter in older browsers
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // Control referrer information sent with requests
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Restrict browser features (camera, microphone, geolocation, etc.)
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=()');

        // Force HTTPS for all future requests (1 year with subdomains)
        if (app()->environment('production')) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        }

        // Remove server identification headers to prevent fingerprinting
        $response->headers->remove('X-Powered-By');
        $response->headers->remove('Server');

        // Prevent caching of sensitive API responses
        if ($request->is('api/*')) {
            $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            $response->headers->set('Pragma', 'no-cache');
        }

        return $response;
    }
}
