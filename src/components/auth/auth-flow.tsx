"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { PoweredByPaga } from "@/components/brand/powered-by-paga";
import { SafrPills } from "@/components/brand/safr-pills";
import { useStatusDialog } from "@/components/feedback/dialog-provider";
import { ApiPlaceholder } from "@/components/feedback/api-placeholder";
import { nigerianBanks } from "@/content/nigerian-banks";
import {
  adminSignIn,
  requestPasswordReset,
  resetPassword,
  signIn,
  signUp,
  updatePayoutAccount,
  verifyEmail,
} from "@/lib/api";

export type AuthPageName =
  | "sign-in"
  | "get-started"
  | "verify-email"
  | "forgot-password"
  | "reset-password"
  | "onboarding"
  | "admin-sign-in";

const emailSchema = z.email("Enter a valid email address.");
const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});
const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: emailSchema,
  phone: z.string().trim().min(8, "Enter a valid phone number."),
  password: z.string().min(8, "Use at least 8 characters."),
});

export function AuthFlow({ page }: { page: AuthPageName }) {
  const router = useRouter();
  const dialog = useStatusDialog();
  const [email, setEmail] = useState(
    page === "sign-in" ? "tolu@example.test" : "",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState(
    page === "sign-in" ? "demo1234" : "",
  );
  const [code, setCode] = useState("");
  const [role, setRole] = useState<"freelancer" | "seller">("freelancer");
  const [showPassword, setShowPassword] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [bankName, setBankName] = useState("Access Bank");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountVerified, setAccountVerified] = useState(false);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const title: Record<AuthPageName, string> = {
    "sign-in": "Welcome back.",
    "get-started": "Get started with PaySafr.",
    "verify-email": "Check your email.",
    "forgot-password": "Forgot your password?",
    "reset-password": "Set a new password.",
    onboarding: "A few details, then you're ready.",
    "admin-sign-in": "Admin sign in",
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (page === "sign-in" || page === "admin-sign-in") {
      const parsed = signInSchema.safeParse({ email, password });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check your details.");
        return;
      }
      setBusy(true);
      try {
        if (page === "admin-sign-in") await adminSignIn(parsed.data);
        else await signIn(parsed.data);
        router.push(
          page === "admin-sign-in" ? "/admin/overview" : "/dashboard",
        );
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "We couldn't sign you in.",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    if (page === "get-started") {
      const parsed = signUpSchema.safeParse({ name, email, phone, password });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check your details.");
        return;
      }
      if (!terms) {
        setError("Accept the terms to create an account.");
        return;
      }
      setBusy(true);
      try {
        await signUp({ ...parsed.data, role });
        dialog.show({
          variant: "success",
          title: "Check your email.",
          description:
            "We sent a six-digit verification code. In this demo, use 123456.",
          primaryAction: {
            label: "Verify email",
            onClick: () => router.push("/verify-email"),
          },
        });
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "We couldn't create your account.",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    if (page === "verify-email") {
      setBusy(true);
      try {
        await verifyEmail(code);
        dialog.show({
          variant: "success",
          title: "Email verified.",
          description: "Your account is ready for the next step.",
          primaryAction: {
            label: "Continue",
            onClick: () => router.push("/onboarding"),
          },
        });
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "We couldn't verify the code.",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    if (page === "forgot-password") {
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Enter a valid email.");
        return;
      }
      setBusy(true);
      try {
        await requestPasswordReset(email);
        dialog.show({
          variant: "success",
          title: "If that address is registered, a reset link is on its way.",
          description:
            "This demo does not send email. You can continue to the reset form.",
          primaryAction: {
            label: "Continue",
            onClick: () => router.push("/reset-password"),
          },
        });
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "We couldn't start the reset.",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    if (page === "reset-password") {
      setBusy(true);
      try {
        await resetPassword({ code, password });
        dialog.show({
          variant: "success",
          title: "Password updated.",
          description: "Sign in with your new password.",
          primaryAction: {
            label: "Sign in",
            onClick: () => router.push("/sign-in"),
          },
        });
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "We couldn't reset your password.",
        );
      } finally {
        setBusy(false);
      }
    }
  }

  async function savePayout() {
    if (!/^\d{10}$/.test(accountNumber) || !accountVerified) {
      setError("Check and confirm your 10-digit payout account first.");
      return;
    }
    setBusy(true);
    try {
      await updatePayoutAccount({
        bankCode:
          nigerianBanks.find((bank) => bank.name === bankName)?.code ?? "044",
        bankName,
        accountNumber,
        accountName,
        verified: true,
      });
      setStep(2);
      dialog.show({
        variant: "success",
        title: "Payout account saved.",
        description: "You can update this later from your account settings.",
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We couldn't save the account.",
      );
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = page === "admin-sign-in";
  const isFormOnlyAuth = page === "sign-in" || page === "get-started";
  return (
    <main
      className={
        isAdmin
          ? "relative min-h-screen bg-[var(--ps-green-900)] px-4 py-10 text-white"
          : "relative min-h-screen bg-white"
      }
    >
      {!isAdmin && !isFormOnlyAuth ? (
        <aside className="relative hidden min-h-screen overflow-hidden bg-[var(--ps-green-900)] p-10 text-white lg:flex lg:w-[45%] lg:flex-col lg:justify-between">
          <div className="absolute -top-20 -right-20 size-96 rounded-full bg-[var(--ps-green-400)]/10 blur-3xl" />
          <div className="relative">
            <Logo tone="on-dark" />
            <p className="font-display mt-16 max-w-md text-5xl leading-tight">
              Work delivered.
              <br />
              Payments secured.
            </p>
            <div className="mt-7">
              <SafrPills />
            </div>
            <ul className="mt-10 space-y-4 text-sm text-white/75">
              <li>
                <ShieldCheck
                  className="mr-2 inline text-[var(--ps-green-400)]"
                  size={17}
                />
                Money held before work starts.
              </li>
              <li>
                <BadgeCheck
                  className="mr-2 inline text-[var(--ps-green-400)]"
                  size={17}
                />
                Clear steps for buyers and sellers.
              </li>
              <li>
                <LockKeyhole
                  className="mr-2 inline text-[var(--ps-green-400)]"
                  size={17}
                />
                Payment confirmed by the bank.
              </li>
            </ul>
            <div className="mt-8 text-xs text-white/60">
              X @usepaysafr · Instagram @usepaysafr · usepaysafr.com
            </div>
          </div>
          <PoweredByPaga tone="on-dark" />
        </aside>
      ) : null}
      <section
        className={
          isAdmin
            ? "mx-auto max-w-md pt-12"
            : isFormOnlyAuth
              ? "mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-12"
              : "mx-auto flex min-h-screen max-w-7xl items-center lg:ml-[45%] lg:max-w-none lg:px-14"
        }
      >
        <div className="w-full px-5 py-8 sm:px-8 lg:max-w-xl">
          {!isAdmin && !isFormOnlyAuth ? (
            <div className="mb-9 lg:hidden">
              <Logo />
            </div>
          ) : isAdmin ? (
            <div className="mb-6 flex items-center justify-between">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                Admin
              </span>
              <span className="rounded-full bg-[var(--ps-green-400)] px-3 py-1 text-xs text-[var(--ps-green-900)]">
                SANDBOX
              </span>
            </div>
          ) : null}
          {!isFormOnlyAuth ? (
            <>
              <p className="text-xs tracking-[0.12em] text-[var(--ps-grey-600)] uppercase">
                {isAdmin ? "PaySafr operations" : "Your PaySafr account"}
              </p>
              <h1 className="font-display mt-2 text-3xl sm:text-4xl">
                {title[page]}
              </h1>
            </>
          ) : null}
          {page === "onboarding" ? (
            <Onboarding
              {...{
                step,
                setStep,
                businessName,
                setBusinessName,
                bankName,
                setBankName,
                accountNumber,
                setAccountNumber,
                accountName,
                setAccountName,
                accountVerified,
                setAccountVerified,
                busy,
                savePayout,
                setError,
                router,
              }}
            />
          ) : (
            <form
              onSubmit={submit}
              aria-label={
                isFormOnlyAuth
                  ? page === "sign-in"
                    ? "Sign in"
                    : "Create account"
                  : undefined
              }
              className={isFormOnlyAuth ? "space-y-5" : "mt-7 space-y-4"}
            >
              {page === "get-started" ? (
                <>
                  <label className="block text-sm">
                    Full name
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
                    />
                  </label>
                  <label className="block text-sm">
                    Email
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
                    />
                  </label>
                  <label className="block text-sm">
                    Phone
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      autoComplete="tel"
                      placeholder="+234"
                      className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
                    />
                  </label>
                  <div>
                    <p className="text-sm">I am a</p>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRole("freelancer")}
                        className={`rounded-xl border p-4 text-left ${role === "freelancer" ? "border-[var(--ps-green-900)] bg-[var(--ps-green-400)]/15" : "border-[var(--ps-grey-200)]"}`}
                      >
                        <BriefcaseBusiness size={18} />
                        <span className="mt-2 block text-sm">Freelancer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole("seller")}
                        className={`rounded-xl border p-4 text-left ${role === "seller" ? "border-[var(--ps-green-900)] bg-[var(--ps-green-400)]/15" : "border-[var(--ps-grey-200)]"}`}
                      >
                        <Store size={18} />
                        <span className="mt-2 block text-sm">
                          Online seller
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
              {page === "verify-email" ? (
                <>
                  <label className="block text-sm">
                    Six-digit code
                    <input
                      value={code}
                      onChange={(event) =>
                        setCode(
                          event.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="money mt-2 h-14 w-full rounded-xl border border-[var(--ps-grey-200)] px-4 text-center text-2xl tracking-[0.5em]"
                      placeholder="000000"
                    />
                  </label>
                  <p className="text-xs text-[var(--ps-grey-600)]">
                    Demo code: 123456
                  </p>
                </>
              ) : null}
              {page === "forgot-password" ? (
                <label className="block text-sm">
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
                  />
                </label>
              ) : null}
              {page === "reset-password" ? (
                <>
                  <label className="block text-sm">
                    Reset code
                    <input
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
                    />
                  </label>
                  <PasswordField
                    password={password}
                    setPassword={setPassword}
                    show={showPassword}
                    setShow={setShowPassword}
                  />
                </>
              ) : null}
              {page === "sign-in" || isAdmin ? (
                <>
                  <label className="block text-sm">
                    Email
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="username"
                      className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
                    />
                  </label>
                  <PasswordField
                    password={password}
                    setPassword={setPassword}
                    show={showPassword}
                    setShow={setShowPassword}
                  />
                  {page === "sign-in" ? (
                    <div className="text-right">
                      <a href="/forgot-password" className="text-sm underline">
                        Forgot password?
                      </a>
                    </div>
                  ) : null}
                  {isAdmin ? (
                    <p className="rounded-xl bg-white/10 p-3 text-xs text-white/75">
                      Demo login: admin@paysafr.test · admin1234
                    </p>
                  ) : null}
                </>
              ) : null}
              {page === "get-started" ? (
                <>
                  <PasswordField
                    password={password}
                    setPassword={setPassword}
                    show={showPassword}
                    setShow={setShowPassword}
                  />
                  <p className="text-xs text-[var(--ps-grey-600)]">
                    Use at least 8 characters with a mix of letters and numbers.
                  </p>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={terms}
                      onChange={(event) => setTerms(event.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      I agree to the{" "}
                      <a href="/terms" className="underline">
                        Terms
                      </a>{" "}
                      and{" "}
                      <a href="/privacy" className="underline">
                        Privacy Notice
                      </a>
                      .
                    </span>
                  </label>
                </>
              ) : null}
              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-[var(--ps-danger)]/40 bg-[var(--ps-danger)]/5 p-3 text-sm text-[var(--ps-danger)]"
                >
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={
                  busy || (page === "verify-email" && code.length !== 6)
                }
                className="btn-primary w-full disabled:opacity-50"
              >
                {busy
                  ? "Please wait…"
                  : page === "sign-in"
                    ? "Sign in"
                    : page === "admin-sign-in"
                      ? "Sign in to admin"
                      : page === "get-started"
                        ? "Create account"
                        : page === "verify-email"
                          ? "Verify email"
                          : page === "forgot-password"
                            ? "Send reset link"
                            : "Reset password"}{" "}
                <ArrowRight size={17} />
              </button>
              {page === "verify-email" ? (
                <button
                  type="button"
                  disabled={cooldown > 0}
                  onClick={() => {
                    setCooldown(30);
                    toast.info("A new demo code is ready: 123456.");
                  }}
                  className="min-h-11 w-full text-sm underline disabled:opacity-50"
                >
                  {cooldown ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
              ) : null}
              {page === "sign-in" ? (
                <p className="text-center text-sm">
                  New here?{" "}
                  <a href="/get-started" className="underline">
                    Get started
                  </a>
                </p>
              ) : null}
              {page === "get-started" ? (
                <p className="text-center text-sm">
                  Already have an account?{" "}
                  <a href="/sign-in" className="underline">
                    Sign in
                  </a>
                </p>
              ) : null}
              {page === "reset-password" ? (
                <p className="text-center text-sm">
                  <a href="/sign-in" className="underline">
                    Back to sign in
                  </a>
                </p>
              ) : null}
              {!isFormOnlyAuth ? (
                <ApiPlaceholder
                  endpoint={
                    page === "verify-email"
                      ? "POST /api/auth/verify-email"
                      : page === "forgot-password"
                        ? "POST /api/auth/forgot-password"
                        : page === "reset-password"
                          ? "POST /api/auth/reset-password"
                          : "POST /api/admin/auth/sign-in"
                  }
                />
              ) : null}
            </form>
          )}
          {page === "forgot-password" ? (
            <a href="/sign-in" className="mt-5 inline-block text-sm underline">
              Back to sign in
            </a>
          ) : null}
          {page === "onboarding" ? (
            <ApiPlaceholder endpoint="PUT /api/me/payout-account" />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function PasswordField({
  password,
  setPassword,
  show,
  setShow,
}: {
  password: string;
  setPassword: (value: string) => void;
  show: boolean;
  setShow: (value: boolean) => void;
}) {
  return (
    <label className="block text-sm">
      Password
      <span className="mt-2 flex h-12 items-center rounded-xl border border-[var(--ps-grey-200)] pr-3">
        <input
          type={show ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="h-full min-w-0 flex-1 rounded-xl bg-transparent px-4 outline-none"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? "Hide password" : "Show password"}
          className="flex size-10 items-center justify-center"
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

function Onboarding({
  step,
  setStep,
  businessName,
  setBusinessName,
  bankName,
  setBankName,
  accountNumber,
  setAccountNumber,
  accountName,
  setAccountName,
  accountVerified,
  setAccountVerified,
  busy,
  savePayout,
  setError,
  router,
}: {
  step: number;
  setStep: (n: number) => void;
  businessName: string;
  setBusinessName: (v: string) => void;
  bankName: string;
  setBankName: (v: string) => void;
  accountNumber: string;
  setAccountNumber: (v: string) => void;
  accountName: string;
  setAccountName: (v: string) => void;
  accountVerified: boolean;
  setAccountVerified: (v: boolean) => void;
  busy: boolean;
  savePayout: () => void;
  setError: (v: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="mt-6">
      <div className="flex gap-2">
        {[0, 1, 2].map((item) => (
          <span
            key={item}
            className={`h-1.5 flex-1 rounded-full ${step >= item ? "bg-[var(--ps-green-900)]" : "bg-[var(--ps-grey-200)]"}`}
          />
        ))}
      </div>
      {step === 0 ? (
        <div className="mt-6">
          <h2 className="font-display text-xl">Set up your profile.</h2>
          <label className="mt-4 block text-sm">
            Business or display name
            <input
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
              placeholder="Your name or business"
            />
          </label>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mt-5 min-h-12 w-full rounded-full bg-[var(--ps-green-400)]"
          >
            Continue
          </button>
        </div>
      ) : null}
      {step === 1 ? (
        <div className="mt-6">
          <h2 className="font-display text-xl">Where should payouts go?</h2>
          <label className="mt-4 block text-sm">
            Bank
            <select
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-3"
            >
              {nigerianBanks.map((bank) => (
                <option key={bank.code} value={bank.name}>
                  {bank.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-sm">
            Account number
            <input
              inputMode="numeric"
              maxLength={10}
              value={accountNumber}
              onChange={(event) => {
                setAccountNumber(
                  event.target.value.replace(/\D/g, "").slice(0, 10),
                );
                setAccountVerified(false);
              }}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (!/^\d{10}$/.test(accountNumber)) {
                setError("Enter a valid 10-digit account number.");
                return;
              }
              setAccountName("Tolu A. (Demo)");
              setAccountVerified(true);
            }}
            className="mt-4 min-h-11 rounded-full border border-[var(--ps-green-900)] px-4 text-sm"
          >
            Check account name
          </button>
          {accountName ? (
            <p className="mt-3 flex items-center gap-2 text-sm">
              <BadgeCheck size={17} />
              {accountName}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy || !accountVerified}
            onClick={savePayout}
            className="mt-5 min-h-12 w-full rounded-full bg-[var(--ps-green-400)] disabled:opacity-50"
          >
            Save and continue
          </button>
          <button
            type="button"
            onClick={() => {
              setStep(2);
              toast.info("You can add a payout account later in settings.");
            }}
            className="mt-2 min-h-11 w-full text-sm underline"
          >
            Skip for now
          </button>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="mt-6 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--ps-green-400)]/25">
            <BadgeCheck size={27} />
          </span>
          <h2 className="font-display mt-4 text-2xl">
            You&apos;re ready to go.
          </h2>
          {!accountVerified ? (
            <p className="mt-2 rounded-xl bg-[var(--ps-warning)]/20 p-3 text-sm">
              Add a payout account before publishing your first order.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => router.push("/orders/new")}
            className="mt-5 min-h-12 w-full rounded-full bg-[var(--ps-green-400)]"
          >
            Create your first order
          </button>
        </div>
      ) : null}
    </div>
  );
}
