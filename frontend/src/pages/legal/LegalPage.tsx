import { Link } from 'react-router-dom';
import { PublicHeader } from '../../components/common/PublicHeader';
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../../content/legal';
import type { LegalDoc } from '../../content/legal';

function LegalDocView({ doc, other }: { doc: LegalDoc; other: { to: string; label: string } }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <article className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-10">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{doc.title}</h1>
          <p className="mt-2 text-sm text-gray-500">시행일: {doc.effectiveDate}</p>
          <p className="mt-6 leading-relaxed text-gray-700">{doc.intro}</p>
          {doc.sections.map((s) => (
            <section key={s.title} className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900">{s.title}</h2>
              <div className="mt-3 space-y-2 text-[15px] leading-relaxed text-gray-700">
                {s.body.some((b) => b.startsWith('- ')) ? (
                  <>
                    {s.body.filter((b) => !b.startsWith('- ')).map((b) => (
                      <p key={b}>{b}</p>
                    ))}
                    <ul className="list-disc space-y-1.5 pl-5">
                      {s.body.filter((b) => b.startsWith('- ')).map((b) => (
                        <li key={b}>{b.slice(2)}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  s.body.map((b) => <p key={b}>{b}</p>)
                )}
              </div>
            </section>
          ))}
        </article>
        <p className="mt-6 text-center text-sm text-gray-500">
          <Link to={other.to} className="text-blue-600 hover:underline">{other.label}</Link>
          {' · '}
          <Link to="/" className="hover:underline">홈으로</Link>
        </p>
      </main>
    </div>
  );
}

export function PrivacyPage() {
  return <LegalDocView doc={PRIVACY_POLICY} other={{ to: '/terms', label: '이용약관 보기' }} />;
}

export function TermsPage() {
  return <LegalDocView doc={TERMS_OF_SERVICE} other={{ to: '/privacy', label: '개인정보처리방침 보기' }} />;
}
