"use client";

import "./login.css";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import axiosInstance from "@/lib/axios";
import Cookies from "js-cookie";
import axios from "axios";
import Image from "next/image";
import { Eye, EyeOff, Loader2, Building2, Globe } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [suggestions, setSuggestions] = useState<{ id: number; name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  
  const [selectedFromSuggestion, setSelectedFromSuggestion] = useState(false);
  
  const companyInputRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (companyInputRef.current && !companyInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Debounced search for companies
  useEffect(() => {
    const fetchCompanies = async () => {
      if (companyName.trim().length < 2 || selectedFromSuggestion) {
        if (!selectedFromSuggestion) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
        setSelectedFromSuggestion(false); // Reset for next typing
        return;
      }

      setIsSearching(true);
      try {
        const response = await axiosInstance.get(`/companies/search?q=${companyName}`);
        if (response.data.status === 'success') {
          setSuggestions(response.data.data);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error("Gagal mengambil saran perusahaan", err);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(fetchCompanies, 300);
    return () => clearTimeout(timeoutId);
  }, [companyName]);

  const handleSelectSuggestion = (name: string) => {
    setSelectedFromSuggestion(true);
    setCompanyName(name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axiosInstance.post("/login", {
        email,
        password,
        company_name: companyName,
      });
      if (response.data.data && response.data.data.access_token) {
        const { access_token, refresh_token, expires_in } = response.data.data;
        const isSecure = window.location.protocol === "https:";
        
        // Calculate access token expiry in days
        const accessExpiryDays = expires_in ? expires_in / 86400 : 1;
        
        // Save access token with secure flags
        Cookies.set("token", access_token, {
          expires: keepLoggedIn ? accessExpiryDays : undefined, // session cookie if not "keep logged in"
          secure: isSecure,
          sameSite: "strict",
        });
        
        // Save refresh token (long-lived, 30 days)
        if (refresh_token) {
          Cookies.set("refresh_token", refresh_token, {
            expires: 30,
            secure: isSecure,
            sameSite: "strict",
          });
        }
        router.push("/dashboard");
      } else {
        setError("Gagal mendapatkan token auth.");
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ||
            "Kredensial tidak valid atau terjadi kesalahan server."
        );
      } else {
        setError("Terjadi kesalahan yang tidak terduga.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!companyName.trim()) {
      setError("Pilih Perusahaan terlebih dahulu!");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Import Firebase secara dynamic (agar tidak memberat initial load)
      const { auth, googleProvider } = await import("@/lib/firebase");
      const { signInWithPopup } = await import("firebase/auth");

      // 2. Tampilkan popup Google Sign-In
      const result = await signInWithPopup(auth, googleProvider);
      
      // 3. Ambil Google ID Token dari credential
      const credential = await import("firebase/auth").then(m => 
        m.GoogleAuthProvider.credentialFromResult(result)
      );
      const googleIdToken = credential?.idToken;

      if (!googleIdToken) {
        setError("Gagal mendapatkan token dari Google.");
        setLoading(false);
        return;
      }

      // 4. Kirim Google ID Token ke backend
      const response = await axiosInstance.post("/login-google", {
        id_token: googleIdToken,
        company_name: companyName,
      });

      if (response.data.data && response.data.data.access_token) {
        const { access_token, refresh_token, expires_in } = response.data.data;
        const isSecure = window.location.protocol === "https:";
        const accessExpiryDays = expires_in ? expires_in / 86400 : 1;

        Cookies.set("token", access_token, {
          expires: keepLoggedIn ? accessExpiryDays : undefined,
          secure: isSecure,
          sameSite: "strict",
        });

        if (refresh_token) {
          Cookies.set("refresh_token", refresh_token, {
            expires: 30,
            secure: isSecure,
            sameSite: "strict",
          });
        }

        router.push("/dashboard");
      } else {
        setError(response.data.message || "Gagal login dengan Google.");
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Gagal login dengan Google.");
      } else if (err instanceof Error && err.message.includes("popup-closed")) {
        // User menutup popup Google — tidak perlu tampilkan error
        setError("");
      } else {
        setError("Gagal login dengan Google. Silakan coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Left Panel - Illustration */}
        <div className="login-left-panel">
          <div className="login-left-content">
            <div className="login-illustration-wrapper">
                <Image
                  src="/login-illustration.png"
                  alt="HR Management Illustration"
                  width={400}
                  height={350}
                  className="login-illustration"
                  priority
                  unoptimized={true}
                />
            </div>
            <div className="login-left-text">
              <h2>Kelola SDM Lebih Efisien dengan Digital HRMS</h2>
              <p>
                Platform manajemen SDM terintegrasi untuk pengelolaan data
                karyawan, absensi, penggajian, dan masih banyak lagi.
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="login-right-panel">
          {/* Language Toggle */}
          <button className="login-lang-btn" type="button">
            <Globe size={14} />
            <span>ID</span>
          </button>

          <div className="login-form-container">
            {/* Logo & Title */}
            <div className="login-header">
              <div className="login-logo-wrapper">
                <Image
                  src="/logo.png"
                  alt="On Time HRMS Logo"
                  width={80}
                  height={60}
                  className="login-logo"
                  priority
                  unoptimized={true}
                />
              </div>
              <div className="login-brand">
                <h1 className="login-title">Welcome Back!</h1>
                <p className="login-subtitle">ON TIME HRMS (OT)</p>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="login-form" autoComplete="off" suppressHydrationWarning>
              {error && (
                <div className="login-error">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Company Identifier */}
              <div className="login-field" ref={companyInputRef}>
                <label htmlFor="company" className="login-label">
                  Company Identifier
                </label>
                <input
                  id="company"
                  type="text"
                  placeholder="Ketik nama perusahaan..."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  autoComplete="off"
                  className="login-input"
                  suppressHydrationWarning
                />
                {showSuggestions && (
                  <ul className="login-suggestions">
                    {isSearching ? (
                      <div className="login-suggestion-empty">
                        <Loader2 size={16} className="login-spinner" style={{ display: 'inline-block', marginRight: 6 }} />
                        Mencari...
                      </div>
                    ) : suggestions.length > 0 ? (
                      suggestions.map((company) => (
                        <li
                          key={company.id}
                          className="login-suggestion-item"
                          onClick={() => handleSelectSuggestion(company.name)}
                        >
                          <Building2 className="login-suggestion-icon" size={16} />
                          <span>{company.name}</span>
                        </li>
                      ))
                    ) : (
                      <div className="login-suggestion-empty">
                        Perusahaan tidak ditemukan
                      </div>
                    )}
                  </ul>
                )}
              </div>

              {/* Email */}
              <div className="login-field">
                <label htmlFor="email" className="login-label">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="contoh@perusahaan.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="login-input"
                  suppressHydrationWarning
                />
              </div>

              {/* Password */}
              <div className="login-field">
                <div className="login-label-row">
                  <label htmlFor="password" className="login-label">
                    Password
                  </label>
                  <a href="/forgot-password" className="login-forgot">
                    Forgot Password?
                  </a>
                </div>
                <div className="login-input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="login-input login-input-password"
                    suppressHydrationWarning
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    suppressHydrationWarning
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Keep me logged in & Privacy */}
              <div className="login-checkbox-row">
                <label className="login-keep-logged">
                  <input
                    type="checkbox"
                    className="login-checkbox"
                    checked={keepLoggedIn}
                    onChange={(e) => setKeepLoggedIn(e.target.checked)}
                    suppressHydrationWarning
                  />
                  <span className="login-keep-label">Keep me logged in</span>
                </label>
              </div>

              <div className="login-privacy-row">
                <input
                  type="checkbox"
                  className="login-privacy-checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  suppressHydrationWarning
                />
                <span className="login-privacy-text">
                  I agree and accept the{" "}
                  <a href="#" className="login-privacy-link">
                    Privacy Policy
                  </a>
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="login-submit-btn"
                disabled={loading}
                suppressHydrationWarning
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="login-spinner" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Login</span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="login-divider">
              <div className="login-divider-line" />
              <span className="login-divider-text">Or</span>
              <div className="login-divider-line" />
            </div>

            {/* Social Login */}
            <div className="login-social-group">
              <button
                type="button"
                className="login-social-btn"
                onClick={handleGoogleLogin}
              >
                <svg className="login-google-icon" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Login With Google</span>
              </button>
            </div>

            {/* Footer */}
            <div className="login-footer">
              <p>© 2026 On Time HRMS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
