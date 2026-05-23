import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// Custom metrics to track load balancer behavior
const responseTrend = new Trend('api_response_time');
const successCounter = new Counter('api_success_count');
const failureCounter = new Counter('api_failure_count');

// Test Configuration
export const options = {
    stages: [
        { duration: '10s', target: 20 }, // Ramp-up from 0 to 20 users
        { duration: '20s', target: 50 }, // Ramp-up from 20 to 50 users and stress test
        { duration: '15s', target: 50 }, // Hold steady at 50 users
        { duration: '10s', target: 0 },  // Ramp-down to 0 users
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'], // Fail rate must be under 1%
        http_req_duration: ['p(95)<300'], // 95% of requests must complete under 300ms
    },
};

// Target Endpoint (uses localhost or hrms-proxy for Docker network)
const BASE_URL = __ENV.TARGET_URL || 'http://localhost/api/health';

export default function () {
    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        timeout: '5s',
    };

    // Execute GET Health check
    const response = http.get(BASE_URL, params);

    // Track response metrics
    responseTrend.add(response.timings.duration);

    const isSuccess = check(response, {
        'status is 200': (r) => r.status === 200,
        'has healthy status': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.status === 'healthy';
            } catch (e) {
                return false;
            }
        },
        'database is connected': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.database === 'connected';
            } catch (e) {
                return false;
            }
        }
    });

    if (isSuccess) {
        successCounter.add(1);
    } else {
        failureCounter.add(1);
        console.warn(`[!] Request failed. Status: ${response.status}. Body: ${response.body}`);
    }

    // Pace requests slightly to simulate user interaction
    sleep(0.5);
}
