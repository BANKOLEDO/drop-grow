import { Link } from "react-router-dom";
import { Icon } from "@/components/icons/icons";

export default function Privacy() {
  return (
    <div className="shell section-pad">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-ink-500 hover:text-ink-800"
        >
          <Icon.ArrowLeft width={14} height={14} />
          <span className="mono-label">back</span>
        </Link>

        <div className="relative overflow-hidden rounded-[20px] border border-line bg-surface">
          <div className="absolute inset-0 bg-dotpaper-thick opacity-40" />
          <div className="absolute left-0 right-0 top-0 h-[3px] bg-verdant-500" />
          <div className="relative p-8 sm:p-10">
            <h1 className="font-display text-3xl text-ink-900">Privacy Policy</h1>
            <p className="mt-2 text-sm text-ink-500">Last updated August 2026</p>

            <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-700">
              <section>
                <h2 className="mb-2 font-display text-lg text-ink-900">
                  1. What We Collect
                </h2>
                <p>
                  drop&grow collects only what you provide: your chosen display name and
                  handle, your ideas (in any format, including text, voice transcription,
                  and image descriptions), and your contributions. We store a session
                  token on your device for authentication.
                </p>
              </section>

              <section>
                <h2 className="mb-2 font-display text-lg text-ink-900">
                  2. What We Do Not Collect
                </h2>
                <p>
                  We do not collect email addresses, phone numbers, passwords, or payment
                  information. We do not use cookies for tracking. We do not run analytics
                  or advertising scripts.
                </p>
              </section>

              <section>
                <h2 className="mb-2 font-display text-lg text-ink-900">
                  3. How Your Data Is Used
                </h2>
                <p>
                  Your ideas are processed by the agent engine to generate plans. This
                  processing happens entirely within the platform, and your content is
                  never sent to third parties for training or analysis.
                </p>
              </section>

              <section>
                <h2 className="mb-2 font-display text-lg text-ink-900">
                  4. Data Sharing
                </h2>
                <p>
                  We do not sell, rent, or share your personal data with third parties.
                  Community-visible ideas are accessible to other drop&grow users by design,
                  since you chose to publish them. Private ideas remain visible only to
                  you.
                </p>
              </section>

              <section>
                <h2 className="mb-2 font-display text-lg text-ink-900">
                  5. Data Retention
                </h2>
                <p>
                  Your data persists as long as your account exists. You can delete
                  individual ideas at any time. Session tokens are stored locally on your
                  device and can be cleared by signing out or clearing browser storage.
                </p>
              </section>

              <section>
                <h2 className="mb-2 font-display text-lg text-ink-900">6. Security</h2>
                <p>
                  Session tokens are hashed before storage. We use Convex's secure model
                  where every function call is authenticated. No system is perfectly
                  secure. Use a unique handle and treat your session token like a password.
                </p>
              </section>

              <section>
                <h2 className="mb-2 font-display text-lg text-ink-900">
                  7. Children's Privacy
                </h2>
                <p>
                  drop&grow is not intended for users under 13. We do not knowingly collect
                  data from children.
                </p>
              </section>

              <section>
                <h2 className="mb-2 font-display text-lg text-ink-900">
                  8. Changes to This Policy
                </h2>
                <p>
                  If we update this policy, we will notify you through the platform.
                  Continued use after changes constitutes acceptance of the updated policy.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
