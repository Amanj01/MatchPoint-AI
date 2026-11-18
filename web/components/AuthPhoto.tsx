import { photo } from './ui';

const QUOTES = {
  login: {
    img: '1531482615713-2afd69097998',
    text: 'I listed my skills on a Sunday. By Wednesday I had two interviews and an invite I didn’t even apply for.',
    who: 'Shilan, Frontend Developer',
  },
  register: {
    img: '1522071820081-009f0129c71c',
    text: 'We posted one role and the best three candidates were already at the top of the list. Hiring took a week.',
    who: 'Hemin, Head of Engineering',
  },
};

/** Right half of the login and sign-up screens. Demo testimonial, fictional people. */
export function AuthPhoto({ variant }: { variant: keyof typeof QUOTES }) {
  const q = QUOTES[variant];
  return (
    <div className="auth-photo" aria-hidden>
      <img src={photo(q.img, 1200)} alt="" />
      <blockquote>
        “{q.text}”
        <cite>— {q.who}</cite>
      </blockquote>
    </div>
  );
}
