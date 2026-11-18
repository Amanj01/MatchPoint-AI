import type { CV } from '@/lib/api';

/** The rendered CV. Three templates; prints cleanly to PDF. */
export function CVDocument({ cv, template = 'modern' }: { cv: CV; template?: string }) {
  const contact = [cv.contact?.email, cv.contact?.phone, cv.contact?.location, cv.contact?.links].filter(Boolean);
  return (
    <article className={`cv cv-${template}`}>
      <header className="cv-head">
        <div>
          <h1>{cv.name}</h1>
          <p className="cv-headline">{cv.headline}</p>
        </div>
        <p className="cv-contact">{contact.map((c, i) => <span key={i}>{c}</span>)}</p>
      </header>

      <div className="cv-body">
        <main>
          <section>
            <h2>Profile</h2>
            <p>{cv.summary}</p>
          </section>

          {cv.experience?.length > 0 && (
            <section>
              <h2>Experience</h2>
              {cv.experience.map((e, i) => (
                <div key={i} className="cv-item">
                  <div className="cv-item-head"><strong>{e.title}</strong><span>{e.period}</span></div>
                  <div className="cv-org">{e.company}</div>
                  <ul>{e.bullets.map((b, k) => <li key={k}>{b}</li>)}</ul>
                </div>
              ))}
            </section>
          )}

          {cv.projects?.length > 0 && (
            <section>
              <h2>Projects</h2>
              {cv.projects.map((p, i) => (
                <div key={i} className="cv-item">
                  <div className="cv-item-head"><strong>{p.name}</strong><span>{p.tech?.join(' · ')}</span></div>
                  <p>{p.description}</p>
                </div>
              ))}
            </section>
          )}

          {cv.education?.length > 0 && (
            <section>
              <h2>Education</h2>
              {cv.education.map((e, i) => (
                <div key={i} className="cv-item">
                  <div className="cv-item-head"><strong>{e.degree}</strong><span>{e.period}</span></div>
                  <div className="cv-org">{e.school}</div>
                  {e.details && <p>{e.details}</p>}
                </div>
              ))}
            </section>
          )}
        </main>

        <aside>
          {cv.strengths?.length > 0 && (
            <section>
              <h2>Strengths</h2>
              <ul className="cv-plain">{cv.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
            </section>
          )}
          <section>
            <h2>Skills</h2>
            {cv.skills?.map((g) => (
              <div key={g.category} className="cv-skillgroup">
                <h3>{g.category}</h3>
                <p>{g.items.join(', ')}</p>
              </div>
            ))}
          </section>
          {cv.languages?.length > 0 && (
            <section>
              <h2>Languages</h2>
              <ul className="cv-plain">{cv.languages.map((l) => <li key={l}>{l}</li>)}</ul>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}
